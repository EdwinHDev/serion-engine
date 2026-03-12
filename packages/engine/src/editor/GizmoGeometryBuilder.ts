export type GizmoPart = 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'center' | 'rx' | 'ry' | 'rz';
export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale';

export interface GizmoState {
  mode: TransformMode;
  hoveredPart: GizmoPart | null;
  isDragging: boolean;
  dragStartAngle: number;
  currentDeltaAngle: number;
  snapEnabled: boolean;
  snapValue: number;
}

export const GIZMO_ROT_RADIUS = 5.0;
export const GIZMO_ROT_WIDTH = 0.5;

export class GizmoGeometryBuilder {
  public static build(state: GizmoState): Float32Array {
    const data: number[] = [];
    const pushV = (x: number, y: number, z: number, c: number[]) => { data.push(x, y, z, c[0], c[1], c[2]); };

    const red = [1.0, 0.05, 0.05]; const green = [0.05, 1.0, 0.05]; const blue = [0.1, 0.25, 1.0];
    const white = [1.0, 1.0, 1.0]; const yellow = [1.0, 1.0, 0.0]; const gray = [0.6, 0.6, 0.6];

    const getColor = (part: GizmoPart, defaultColor: number[]) => state.hoveredPart === part ? yellow : defaultColor;

    if (state.mode === 'translate' || state.mode === 'scale') {
      const SCALE = 1.0;
      const stemRadius = 0.12 * SCALE; const stemLength = 5.0 * SCALE;
      const coneRadius = 0.45 * SCALE; const coneHeight = 1.5 * SCALE;
      const boxRadius = 0.4 * SCALE;
      const planeSize = 1.2 * SCALE; const planeOffset = 1.5 * SCALE;
      const transCenterSize = 0.3 * SCALE; const scaleCenterSize = 0.5 * SCALE;

      const addCylinder = (axis: 'x'|'y'|'z', length: number, radius: number, color: number[]) => {
        const segments = 12;
        for(let i=0; i<segments; i++) {
          const t1 = (i/segments)*Math.PI*2; const t2 = ((i+1)/segments)*Math.PI*2;
          const c1 = Math.cos(t1)*radius; const s1 = Math.sin(t1)*radius;
          const c2 = Math.cos(t2)*radius; const s2 = Math.sin(t2)*radius;
          const getP = (d: number, u: number, v: number) => axis==='x'?[d,u,v]:axis==='y'?[u,d,v]:[u,v,d];
          const p1 = getP(0,c1,s1); const p2 = getP(0,c2,s2); const p3 = getP(length,c1,s1); const p4 = getP(length,c2,s2);
          pushV(p1[0],p1[1],p1[2],color); pushV(p2[0],p2[1],p2[2],color); pushV(p3[0],p3[1],p3[2],color);
          pushV(p2[0],p2[1],p2[2],color); pushV(p4[0],p4[1],p4[2],color); pushV(p3[0],p3[1],p3[2],color);
        }
      };

      const addCone = (axis: 'x'|'y'|'z', offset: number, height: number, radius: number, color: number[]) => {
        const segments = 12;
        for(let i=0; i<segments; i++) {
          const t1 = (i/segments)*Math.PI*2; const t2 = ((i+1)/segments)*Math.PI*2;
          const c1 = Math.cos(t1)*radius; const s1 = Math.sin(t1)*radius;
          const c2 = Math.cos(t2)*radius; const s2 = Math.sin(t2)*radius;
          const getP = (d: number, u: number, v: number) => axis==='x'?[d,u,v]:axis==='y'?[u,d,v]:[u,v,d];
          const p1 = getP(offset,c1,s1); const p2 = getP(offset,c2,s2);
          const tip = getP(offset+height,0,0); const center = getP(offset,0,0);
          pushV(p1[0],p1[1],p1[2],color); pushV(p2[0],p2[1],p2[2],color); pushV(tip[0],tip[1],tip[2],color);
          pushV(p2[0],p2[1],p2[2],color); pushV(p1[0],p1[1],p1[2],color); pushV(center[0],center[1],center[2],color);
        }
      };

      const addTipBox = (axis: 'x'|'y'|'z', offset: number, size: number, color: number[]) => {
        const getP = (d: number, u: number, v: number) => axis==='x'?[d,u,v]:axis==='y'?[u,d,v]:[u,v,d];
        const v = [
          getP(offset-size,-size,-size), getP(offset+size,-size,-size), getP(offset+size,size,-size), getP(offset-size,size,-size),
          getP(offset-size,-size,size), getP(offset+size,-size,size), getP(offset+size,size,size), getP(offset-size,size,size)
        ];
        const idx = [0,1,2, 0,2,3, 4,6,5, 4,7,6, 0,4,5, 0,5,1, 3,2,6, 3,6,7, 0,3,7, 0,7,4, 1,5,6, 1,6,2];
        for (const i of idx) pushV(v[i][0],v[i][1],v[i][2],color);
      };

      const addPlaneTri = (a1: 'x'|'y'|'z', a2: 'x'|'y'|'z', offset: number, size: number, color: number[]) => {
        const p1=[0,0,0], p2=[0,0,0], p3=[0,0,0], p4=[0,0,0];
        const set = (p: number[], a: string, v: number) => { if(a==='x') p[0]=v; else if(a==='y') p[1]=v; else p[2]=v; };
        
        if (state.mode === 'translate') {
          set(p1,a1,offset); set(p1,a2,offset); set(p2,a1,offset+size); set(p2,a2,offset);
          set(p3,a1,offset+size); set(p3,a2,offset+size); set(p4,a1,offset); set(p4,a2,offset+size);
          pushV(p1[0],p1[1],p1[2],color); pushV(p2[0],p2[1],p2[2],color); pushV(p3[0],p3[1],p3[2],color);
          pushV(p1[0],p1[1],p1[2],color); pushV(p3[0],p3[1],p3[2],color); pushV(p4[0],p4[1],p4[2],color);
          pushV(p1[0],p1[1],p1[2],color); pushV(p3[0],p3[1],p3[2],color); pushV(p2[0],p2[1],p2[2],color);
          pushV(p1[0],p1[1],p1[2],color); pushV(p4[0],p4[1],p4[2],color); pushV(p3[0],p3[1],p3[2],color);
        } else {
          set(p1,a1,offset+size); set(p1,a2,offset); set(p2,a1,offset); set(p2,a2,offset+size); set(p3,a1,offset); set(p3,a2,offset);
          pushV(p1[0],p1[1],p1[2],color); pushV(p2[0],p2[1],p2[2],color); pushV(p3[0],p3[1],p3[2],color);
          pushV(p1[0],p1[1],p1[2],color); pushV(p3[0],p3[1],p3[2],color); pushV(p2[0],p2[1],p2[2],color);
        }
      };

      const addCenterBox = (size: number, color: number[]) => {
        const v = [[-size,-size,-size],[size,-size,-size],[size,size,-size],[-size,size,-size],[-size,-size,size],[size,-size,size],[size,size,size],[-size,size,size]];
        const idx = [0,1,2,0,2,3, 4,6,5,4,7,6, 0,4,5,0,5,1, 3,2,6,3,6,7, 0,3,7,0,7,4, 1,5,6,1,6,2];
        for (const i of idx) pushV(v[i][0],v[i][1],v[i][2],color);
      };

      addCylinder('x', stemLength, stemRadius, getColor('x', red));
      addCylinder('y', stemLength, stemRadius, getColor('y', green));
      addCylinder('z', stemLength, stemRadius, getColor('z', blue));

      if (state.mode === 'translate') {
        addCone('x', stemLength, coneHeight, coneRadius, getColor('x', red));
        addCone('y', stemLength, coneHeight, coneRadius, getColor('y', green));
        addCone('z', stemLength, coneHeight, coneRadius, getColor('z', blue));
        addCenterBox(transCenterSize, getColor('center', white));
      } else {
        addTipBox('x', stemLength, boxRadius, getColor('x', red));
        addTipBox('y', stemLength, boxRadius, getColor('y', green));
        addTipBox('z', stemLength, boxRadius, getColor('z', blue));
        addCenterBox(scaleCenterSize, getColor('center', white));
      }

      addPlaneTri('x', 'y', planeOffset, planeSize, getColor('xy', blue)); 
      addPlaneTri('x', 'z', planeOffset, planeSize, getColor('xz', green)); 
      addPlaneTri('y', 'z', planeOffset, planeSize, getColor('yz', red));

    } else if (state.mode === 'rotate') {
      
      const addFlatArc = (axis: 'x'|'y'|'z', radius: number, width: number, startAngle: number, endAngle: number, color: number[]) => {
        const segments = Math.max(12, Math.floor(48 * ((endAngle - startAngle) / (Math.PI * 2))));
        const r1 = radius - width / 2; const r2 = radius + width / 2;

        for (let i = 0; i < segments; i++) {
          const t1 = startAngle + (i / segments) * (endAngle - startAngle);
          const t2 = startAngle + ((i + 1) / segments) * (endAngle - startAngle);
          const c1 = Math.cos(t1); const s1 = Math.sin(t1);
          const c2 = Math.cos(t2); const s2 = Math.sin(t2);
          const getP = (r: number, c: number, s: number) => { if (axis === 'z') return [r * c, r * s, 0]; if (axis === 'y') return [r * s, 0, r * c]; return [0, r * c, r * s]; };
          const p1 = getP(r1, c1, s1); const p2 = getP(r2, c1, s1); const p3 = getP(r1, c2, s2); const p4 = getP(r2, c2, s2);

          pushV(p1[0],p1[1],p1[2],color); pushV(p2[0],p2[1],p2[2],color); pushV(p3[0],p3[1],p3[2],color);
          pushV(p2[0],p2[1],p2[2],color); pushV(p4[0],p4[1],p4[2],color); pushV(p3[0],p3[1],p3[2],color);
          pushV(p1[0],p1[1],p1[2],color); pushV(p3[0],p3[1],p3[2],color); pushV(p2[0],p2[1],p2[2],color);
          pushV(p2[0],p2[1],p2[2],color); pushV(p3[0],p3[1],p3[2],color); pushV(p4[0],p4[1],p4[2],color);
        }
      };

      const addWedge = (axis: 'x'|'y'|'z', radius: number, startAngle: number, deltaAngle: number, color: number[]) => {
        if (Math.abs(deltaAngle) < 0.001) return;
        const segments = Math.max(4, Math.floor(48 * (Math.abs(deltaAngle) / (Math.PI * 2))));
        const step = deltaAngle / segments;
        const wedgeColor = [color[0]*0.4, color[1]*0.4, color[2]*0.4];

        for(let i=0; i<segments; i++) {
           const t1 = startAngle + i * step; const t2 = startAngle + (i+1) * step;
           const c1 = Math.cos(t1)*radius; const s1 = Math.sin(t1)*radius;
           const c2 = Math.cos(t2)*radius; const s2 = Math.sin(t2)*radius;
           const getP = (c: number, s: number) => axis==='z'?[c,s,0]:axis==='y'?[s,0,c]:[0,c,s];
           const p1 = getP(c1, s1); const p2 = getP(c2, s2);
           pushV(0,0,0, wedgeColor); pushV(p1[0],p1[1],p1[2], wedgeColor); pushV(p2[0],p2[1],p2[2], wedgeColor);
           pushV(0,0,0, wedgeColor); pushV(p2[0],p2[1],p2[2], wedgeColor); pushV(p1[0],p1[1],p1[2], wedgeColor);
        }
      };

      const addPointer = (axis: 'x'|'y'|'z', radius: number, angle: number, color: number[]) => {
        const size = 0.85; 
        const tipU = radius; const tipV = 0;
        const blU = radius + size; const blV = -size * 0.4;
        const brU = radius + size; const brV = size * 0.4;
        const c = Math.cos(angle); const s = Math.sin(angle);
        const rot = (u: number, v: number) => [u * c - v * s, u * s + v * c];
        const pTip = rot(tipU, tipV); const pBl = rot(blU, blV); const pBr = rot(brU, brV);
        const getP = (pt: number[]) => axis==='z'?[pt[0],pt[1],0] : axis==='y'?[pt[1],0,pt[0]] : [0,pt[0],pt[1]];
        const v1 = getP(pTip); const v2 = getP(pBl); const v3 = getP(pBr);

        pushV(v1[0],v1[1],v1[2], color); pushV(v2[0],v2[1],v2[2], color); pushV(v3[0],v3[1],v3[2], color);
        pushV(v1[0],v1[1],v1[2], color); pushV(v3[0],v3[1],v3[2], color); pushV(v2[0],v2[1],v2[2], color);
      };

      const addRuler = (axis: 'x'|'y'|'z', radius: number, snapDeg: number, color: number[]) => {
        if (snapDeg <= 0) return;
        const step = snapDeg * (Math.PI / 180.0);
        const segments = Math.floor((Math.PI * 2) / step);
        const tickLen = 0.3; const halfW = 0.04; 

        for(let i=0; i<segments; i++) {
            const angle = i * step;
            const c = Math.cos(angle); const s = Math.sin(angle);
            const rot = (u: number, v: number) => [u * c - v * s, u * s + v * c];
            const p1 = rot(radius, -halfW); const p2 = rot(radius + tickLen, -halfW);
            const p3 = rot(radius, halfW); const p4 = rot(radius + tickLen, halfW);
            const getP = (pt: number[]) => axis==='z'?[pt[0],pt[1],0] : axis==='y'?[pt[1],0,pt[0]] : [0,pt[0],pt[1]];
            const v1 = getP(p1); const v2 = getP(p2); const v3 = getP(p3); const v4 = getP(p4);

            pushV(v1[0],v1[1],v1[2], color); pushV(v2[0],v2[1],v2[2], color); pushV(v3[0],v3[1],v3[2], color);
            pushV(v2[0],v2[1],v2[2], color); pushV(v4[0],v4[1],v4[2], color); pushV(v3[0],v3[1],v3[2], color);
            pushV(v1[0],v1[1],v1[2], color); pushV(v3[0],v3[1],v3[2], color); pushV(v2[0],v2[1],v2[2], color);
            pushV(v2[0],v2[1],v2[2], color); pushV(v3[0],v3[1],v3[2], color); pushV(v4[0],v4[1],v4[2], color);
        }
      };

      const drawFull = state.isDragging;
      const activeHover = state.hoveredPart;

      const drawX = !drawFull || activeHover === 'rx';
      const drawY = !drawFull || activeHover === 'ry';
      const drawZ = !drawFull || activeHover === 'rz';

      const spanX = (drawFull && activeHover === 'rx') ? Math.PI * 2 : Math.PI / 2;
      const spanY = (drawFull && activeHover === 'ry') ? Math.PI * 2 : Math.PI / 2;
      const spanZ = (drawFull && activeHover === 'rz') ? Math.PI * 2 : Math.PI / 2;

      if (drawX) addFlatArc('x', GIZMO_ROT_RADIUS, GIZMO_ROT_WIDTH, 0, spanX, getColor('rx', red));
      if (drawY) addFlatArc('y', GIZMO_ROT_RADIUS, GIZMO_ROT_WIDTH, 0, spanY, getColor('ry', green));
      if (drawZ) addFlatArc('z', GIZMO_ROT_RADIUS, GIZMO_ROT_WIDTH, 0, spanZ, getColor('rz', blue));

      if (state.isDragging && state.hoveredPart) {
        const activeAxis = state.hoveredPart === 'rx' ? 'x' : state.hoveredPart === 'ry' ? 'y' : 'z';
        const visualDelta = state.currentDeltaAngle % (Math.PI * 2);
        const wedgeRadius = GIZMO_ROT_RADIUS * 0.96; 
        
        addWedge(activeAxis, wedgeRadius, state.dragStartAngle, visualDelta, yellow);
        
        if (state.snapEnabled && state.snapValue > 0) {
          addRuler(activeAxis, GIZMO_ROT_RADIUS, state.snapValue, gray);
        }
        
        addPointer(activeAxis, GIZMO_ROT_RADIUS, state.dragStartAngle, white); 
        addPointer(activeAxis, GIZMO_ROT_RADIUS, state.dragStartAngle + visualDelta, yellow); 
      }
    }

    return new Float32Array(data);
  }
}
