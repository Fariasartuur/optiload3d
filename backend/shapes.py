"""Rigid, connected unions of non-overlapping cuboids, in local metres."""
from typing import Literal
from math import sin, cos, pi
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Part(BaseModel):
    model_config = ConfigDict(extra='forbid')
    x: float = Field(default=0, ge=0, allow_inf_nan=False)
    y: float = Field(default=0, ge=0, allow_inf_nan=False)
    z: float = Field(default=0, ge=0, allow_inf_nan=False)
    width: float = Field(gt=0, allow_inf_nan=False)
    height: float = Field(gt=0, allow_inf_nan=False)
    depth: float = Field(gt=0, allow_inf_nan=False)
    kind: Literal['box', 'ellipsoid', 'cylinder', 'prism'] = 'box'
    sides: int = Field(default=6, ge=3, le=12)
    yaw: int = Field(default=0, ge=0, le=3)


def polygon_points(sides, yaw=0):
    points = [(sin(i*2*pi/sides-yaw*pi/2), cos(i*2*pi/sides-yaw*pi/2)) for i in range(sides)]
    xs, zs = zip(*points)
    return [((x-min(xs))/(max(xs)-min(xs)), (z-min(zs))/(max(zs)-min(zs))) for x,z in points]


def preset(shape, w, h, d):
    def part(x, y, z, width, height, depth, kind='box'):
        return Part(x=x*w, y=y*h, z=z*d, width=width*w, height=height*h, depth=depth*d, kind=kind)
    if shape == 'sofa':
        return [part(0,0,0,1,.25,1), part(0,.25,0,1,.75,.18), part(0,.25,.18,.15,.4,.82), part(.85,.25,.18,.15,.4,.82), part(.15,.25,.18,.7,.12,.82)]
    if shape == 'bed':
        return [part(0,0,0,1,1,.06), part(0,0,.06,1,.35,.94), part(0,.35,.06,1,.25,.94)]
    if shape == 'stove':
        return [part(0,0,0,1,.96,1)] + [part(x,.96,z,.26,.04,.26,'cylinder') for x in (.12,.62) for z in (.12,.62)]
    if shape not in ('table', 'chair'):
        kind = 'ellipsoid' if shape in ('sphere', 'bag') else 'cylinder' if shape == 'drum' else 'prism' if shape == 'polygon' else 'box'
        return [part(0,0,0,1,1,1,kind)]
    t = min(w, h, d) * .08
    level = h - t if shape == 'table' else h * .48
    parts = [Part(x=0, y=level, z=0, width=w, height=t, depth=d)]
    parts += [Part(x=x, y=0, z=z, width=t, height=level, depth=t)
              for x in (0, w-t) for z in (0, d-t)]
    if shape == 'chair':
        parts.append(Part(x=0, y=level+t, z=0, width=w, height=h-level-t, depth=t))
    return parts


class GeometryInput(BaseModel):
    width: float = Field(gt=0, allow_inf_nan=False)
    height: float = Field(gt=0, allow_inf_nan=False)
    depth: float = Field(gt=0, allow_inf_nan=False)
    shape: Literal['box', 'table', 'chair', 'sofa', 'bed', 'fridge', 'stove', 'washer', 'drum', 'sphere', 'bag', 'polygon', 'custom'] = 'box'
    parts: list[Part] | None = Field(default=None, min_length=1, max_length=24)

    @model_validator(mode='after')
    def geometry(self):
        if self.shape not in ('box', 'custom') and self.parts is None:
            self.parts = preset(self.shape, self.width, self.height, self.depth)
        if self.shape == 'custom' and not self.parts:
            raise ValueError('Um objeto personalizado precisa de peças.')
        if self.shape == 'box' and self.parts:
            raise ValueError('Use shape=custom para objetos compostos.')
        if not self.parts:
            return self
        eps = 1e-8 * min(self.width, self.height, self.depth)
        for axis, size in [('x', 'width'), ('y', 'height'), ('z', 'depth')]:
            if abs(min(getattr(p, axis) for p in self.parts)) > eps or abs(
                max(getattr(p, axis)+getattr(p, size) for p in self.parts)-getattr(self, size)) > eps:
                raise ValueError('As dimensões externas devem coincidir com as peças, começando em (0,0,0).')
        neighbors = {i: set() for i in range(len(self.parts))}
        for i, a in enumerate(self.parts):
            for j, b in enumerate(self.parts[:i]):
                overlaps = [min(getattr(a, k)+getattr(a, s), getattr(b, k)+getattr(b, s))
                            - max(getattr(a, k), getattr(b, k))
                            for k, s in [('x', 'width'), ('y', 'height'), ('z', 'depth')]]
                if all(v > eps for v in overlaps):
                    raise ValueError('Os contornos de proteção das peças não podem se sobrepor.')
                if all(v >= -eps for v in overlaps) and sum(v > eps for v in overlaps) == 2:
                    neighbors[i].add(j)
                    neighbors[j].add(i)
        reached, pending = set(), [0]
        while pending:
            i = pending.pop()
            if i not in reached:
                reached.add(i)
                pending.extend(neighbors[i]-reached)
        if len(reached) != len(self.parts):
            raise ValueError('Todas as peças precisam estar unidas por faces, formando um objeto rígido.')
        return self
