export const GridShaderWGSL = `
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var out: VertexOutput;
    // Forzamos el vértice fuera del Frustum (X=2, Y=2). 
    // La tarjeta gráfica descartará el dibujo antes de llegar al Fragment Shader.
    out.position = vec4<f32>(2.0, 2.0, 2.0, 1.0); 
    return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
    // Si por algún milagro llega aquí, pintará rojo, pero no debería llegar jamás.
    return vec4<f32>(1.0, 0.0, 0.0, 1.0);
}
`;