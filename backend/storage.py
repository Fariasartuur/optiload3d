"""Snapshots persistentes da cena. SQLite local; caminho configurável por ambiente."""
import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from urllib.parse import urlsplit, parse_qs

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # SQLite local funciona sem o driver remoto.
    psycopg = None
    dict_row = None

DATABASE_ERRORS = (sqlite3.Error,) + ((psycopg.Error,) if psycopg else ())

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

router = APIRouter(prefix='/api/layouts', tags=['Organizações salvas'])


class SavedBox(BaseModel):
    model_config = ConfigDict(extra='allow', allow_inf_nan=False)
    id: str
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    depth: float = Field(gt=0)
    x: float = 0
    y: float = 0
    z: float = 0


class SavedTruck(BaseModel):
    model_config = ConfigDict(extra='allow', allow_inf_nan=False)
    id: str
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    depth: float = Field(gt=0)
    boxes: list[SavedBox] = Field(default_factory=list)


class CameraView(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    position: tuple[float, float, float]
    target: tuple[float, float, float]


class SavedScene(BaseModel):
    trucks: list[SavedTruck] = Field(min_length=1)
    camera: CameraView | None = None
    selectedTruckId: str | None = None

    @model_validator(mode='after')
    def unique_ids(self):
        ids = [truck.id for truck in self.trucks]
        if len(set(ids)) != len(ids):
            raise ValueError('IDs de caminhões duplicados.')
        for truck in self.trucks:
            if len({box.id for box in truck.boxes}) != len(truck.boxes):
                raise ValueError('IDs de caixas duplicados dentro do caminhão.')
        if self.selectedTruckId is not None and self.selectedTruckId not in ids:
            raise ValueError('O caminhão selecionado não existe na cena.')
        return self


class SaveLayout(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    scene: SavedScene

    @model_validator(mode='after')
    def valid_payload(self):
        self.name = self.name.strip()
        if not self.name:
            raise ValueError('Informe um nome para a organização.')
        try:
            serialized = json.dumps(self.scene.model_dump(), allow_nan=False)
        except ValueError as exc:
            raise ValueError('A cena contém números inválidos.') from exc
        if len(serialized.encode('utf-8')) > 4_000_000:
            raise ValueError('A organização excede o limite de 4 MB.')
        return self


def database_url():
    return os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL')


def database_path():
    if os.environ.get('VERCEL'):
        raise HTTPException(503, 'Conecte um banco PostgreSQL e configure DATABASE_URL na Vercel.')
    configured = os.environ.get('OPTILOAD_DB_PATH')
    return Path(configured) if configured else Path(__file__).resolve().parent / 'data' / 'optiload.sqlite3'


class PostgresConnection:
    """Adapta apenas os placeholders das consultas internas, nunca seus valores."""
    def __init__(self, connection):
        self.connection = connection

    def execute(self, sql, parameters=None):
        return self.connection.execute(sql.replace('?', '%s'), parameters)

    def commit(self):
        self.connection.commit()

    def close(self):
        self.connection.close()

    def __enter__(self):
        self.connection.__enter__()
        return self

    def __exit__(self, *args):
        return self.connection.__exit__(*args)


def connect():
    db = None
    try:
        url = database_url()
        if url:
            if psycopg is None:
                raise HTTPException(503, 'Instale as dependências PostgreSQL do projeto.')
            parsed = urlsplit(url)
            if parsed.scheme not in ('postgres', 'postgresql'):
                raise HTTPException(503, 'DATABASE_URL deve ser uma conexão PostgreSQL.')
            sslmode = parse_qs(parsed.query).get('sslmode', ['require'])[0]
            if os.environ.get('VERCEL') and sslmode not in ('require', 'verify-ca', 'verify-full'):
                raise HTTPException(503, 'A conexão PostgreSQL em produção deve usar TLS.')
            db = PostgresConnection(psycopg.connect(url, row_factory=dict_row,
                connect_timeout=10, prepare_threshold=None, sslmode=sslmode))
            # Serializa a criação inicial em cold starts concorrentes.
            db.execute('SELECT pg_advisory_xact_lock(716203841)')
        else:
            path = database_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            db = sqlite3.connect(path, timeout=10)
            db.row_factory = sqlite3.Row
        db.execute("""CREATE TABLE IF NOT EXISTS layouts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            schema_version INTEGER NOT NULL,
            truck_count INTEGER NOT NULL,
            box_count INTEGER NOT NULL,
            scene_json TEXT NOT NULL
        )""")
        db.commit()
        return db
    except (OSError, *DATABASE_ERRORS) as exc:
        if db is not None:
            db.close()
        raise HTTPException(503, 'Não foi possível acessar o banco de organizações.') from exc


@router.post('', status_code=201)
def save_layout(payload: SaveLayout):
    identifier = str(uuid4())
    created = datetime.now(timezone.utc).isoformat()
    scene = payload.scene.model_dump()
    box_count = sum(len(t['boxes']) for t in scene['trucks'])
    try:
        with closing(connect()) as db, db:
            db.execute('INSERT INTO layouts VALUES (?, ?, ?, ?, ?, ?, ?)',
                       (identifier, payload.name, created, 1, len(scene['trucks']), box_count,
                        json.dumps(scene, ensure_ascii=False, allow_nan=False)))
    except DATABASE_ERRORS as exc:
        raise HTTPException(503, 'Não foi possível salvar. Tente novamente.') from exc
    return dict(id=identifier, name=payload.name, created_at=created,
                truck_count=len(scene['trucks']), box_count=box_count)


@router.get('')
def list_layouts():
    try:
        with closing(connect()) as db:
            rows = db.execute('SELECT id, name, created_at, truck_count, box_count FROM layouts '
                              'ORDER BY created_at DESC, id DESC').fetchall()
        return {'layouts': [dict(row) for row in rows]}
    except DATABASE_ERRORS as exc:
        raise HTTPException(503, 'Não foi possível listar as organizações.') from exc


@router.get('/{identifier}')
def load_layout(identifier: str):
    try:
        with closing(connect()) as db:
            row = db.execute('SELECT * FROM layouts WHERE id = ?', (identifier,)).fetchone()
    except DATABASE_ERRORS as exc:
        raise HTTPException(503, 'Não foi possível abrir a organização.') from exc
    if row is None:
        raise HTTPException(404, 'Organização não encontrada.')
    return dict(id=row['id'], name=row['name'], created_at=row['created_at'],
                schema_version=row['schema_version'], scene=json.loads(row['scene_json']))
