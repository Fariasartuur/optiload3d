from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from fastapi.middleware.cors import CORSMiddleware
import time
import copy

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BoxInput(BaseModel):
    id: str
    width: float
    height: float
    depth: float
    color: str

class OptimizeRequest(BaseModel):
    truck_w: float
    truck_h: float
    truck_d: float
    boxes: List[BoxInput]

class Box:
    def __init__(self, box_id, w, h, d):
        self.id = box_id
        self.w = w
        self.h = h
        self.d = d
        self.vol = w * h * d
        self.x = 0
        self.y = 0
        self.z = 0
        
    def __repr__(self):
        return f"Box({self.id}: pos=({self.x},{self.y},{self.z}), size=({self.w},{self.h},{self.d}))"

def get_2d_corners(I_hat, W, H, min_w, min_h):
    if not I_hat:
        return [(0, 0)]
    
    I_sorted = sorted(I_hat, key=lambda b: (b.y + b.h, b.x + b.w), reverse=True)
    m = 0
    e = []
    x_bar = 0
    for box in I_sorted:
        if box.x + box.w > x_bar:
            m += 1
            e.append(box)
            x_bar = box.x + box.w
    
    C_hat = [(0, e[0].y + e[0].h)]
    for j in range(1, m):
        C_hat.append((e[j-1].x + e[j-1].w, e[j].y + e[j].h))
    C_hat.append((e[-1].x + e[-1].w, 0))
    
    C_hat_feasible = []
    for (cx, cy) in C_hat:
        if cx + min_w <= W and cy + min_h <= H:
            C_hat_feasible.append((cx, cy))
            
    return C_hat_feasible

def get_area(C_hat, W, H):
    if not C_hat:
        return W * H
    A = C_hat[0][0] * H
    for i in range(1, len(C_hat)):
        A += (C_hat[i][0] - C_hat[i-1][0]) * C_hat[i-1][1]
    A += (W - C_hat[-1][0]) * C_hat[-1][1]
    return A

def get_3d_corners(I, W, H, D, remaining_boxes):
    if not I:
        return [(0, 0, 0)], 0
        
    min_w = min((b.w for b in remaining_boxes), default=0)
    min_h = min((b.h for b in remaining_boxes), default=0)
    min_d = min((b.d for b in remaining_boxes), default=0)
    
    T = {0}
    for b in I:
        T.add(b.z + b.d)
    T_sorted = sorted(list(T))
    
    C_I = []
    prev_C_hat = []
    areas = []
    valid_z = []
    
    for z_k in T_sorted:
        if z_k + min_d > D:
            break
            
        valid_z.append(z_k)
        I_hat_k = [b for b in I if b.z + b.d > z_k]
        
        C_hat_k = get_2d_corners(I_hat_k, W, H, min_w, min_h)
        areas.append(get_area(C_hat_k, W, H))
        
        for cx, cy in C_hat_k:
            if (cx, cy) not in prev_C_hat:
                C_I.append((cx, cy, z_k))
                
        prev_C_hat = C_hat_k
        
    V_I = 0
    if len(areas) > 0:
        for i in range(1, len(areas)):
            V_I += (valid_z[i] - valid_z[i-1]) * areas[i-1]
        V_I += (D - valid_z[-1]) * areas[-1]
    else:
        V_I = W * H * D
        
    return C_I, V_I

def check_overlap(cx, cy, cz, w, h, d, placed_boxes):
    for pb in placed_boxes:
        # Se NÃO estiver totalmente à esquerda, direita, cima, baixo, frente ou trás, é colisão.
        if not (cx + w <= pb.x or cx >= pb.x + pb.w or
                cy + h <= pb.y or cy >= pb.y + pb.h or
                cz + d <= pb.z or cz >= pb.z + pb.d):
            return True
    return False

def solve_single_bin(J, W, H, D, time_limit=5.0): # Timeout de 5 segundos
    best_F = 0
    best_I = []
    
    J_sorted = sorted(J, key=lambda b: b.vol, reverse=True)
    start_time = time.time()
    
    def bb(I, remaining):
        nonlocal best_F, best_I
        
        # Interrompe a recursão se exceder o tempo limite estipulado
        if time.time() - start_time > time_limit:
            return
            
        current_vol = sum(b.vol for b in I)
        C_I, V_I = get_3d_corners(I, W, H, D, remaining)
        
        B = W * H * D
        if current_vol + (B - V_I) <= best_F:
            return
            
        if not C_I:
            if current_vol > best_F:
                best_F = current_vol
                best_I = copy.deepcopy(I)
            return
            
        placed_any = False
        for (cx, cy, cz) in C_I:
            for j_idx, box in enumerate(remaining):
                # Verifica limites físicos DO BAÚ
                if cx + box.w <= W and cy + box.h <= H and cz + box.d <= D:
                    # Verifica COLISÃO COM OUTRAS CAIXAS
                    if not check_overlap(cx, cy, cz, box.w, box.h, box.d, I):
                        placed_any = True
                        box.x, box.y, box.z = cx, cy, cz
                        I.append(box)
                        
                        new_remaining = remaining[:j_idx] + remaining[j_idx+1:]
                        bb(I, new_remaining)
                        
                        I.pop()
                        box.x = box.y = box.z = 0
                    
        if not placed_any:
            if current_vol > best_F:
                best_F = current_vol
                best_I = copy.deepcopy(I)
                
    bb([], J_sorted)
    return best_F, best_I

@app.post("/api/optimize")
def optimize_load(req: OptimizeRequest):
    algo_boxes = [Box(b.id, b.width, b.height, b.depth) for b in req.boxes]
    
    # Chama o algoritmo de otimização (Limitado a 5 segundos de processamento)
    max_vol, packed_boxes = solve_single_bin(algo_boxes, req.truck_w, req.truck_h, req.truck_d)
    
    result_boxes = []
    for pb in packed_boxes:
        original_box = next((b for b in req.boxes if b.id == pb.id), None)
        result_boxes.append({
            "id": pb.id,
            "width": pb.w,
            "height": pb.h,
            "depth": pb.d,
            "x": pb.x,
            "y": pb.y,
            "z": pb.z,
            "color": original_box.color if original_box else "#3498db"
        })
        
    return {"packed_boxes": result_boxes, "max_volume": max_vol}