@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;

struct ResizeParams {
  scaleX: f32,
  scaleY: f32,
  inputWidth: u32,
  inputHeight: u32,
}

@group(0) @binding(2) var<uniform> params: ResizeParams;

@compute @workgroup_size(8, 8)
fn resizeMain(@builtin(global_invocation_id) id: vec3<u32>) {
  let outX = id.x;
  let outY = id.y;
  
  if (outX >= textureDimensions(outputTex).x || outY >= textureDimensions(outputTex).y) {
    return;
  }
  
  let srcX = f32(outX) * params.scaleX;
  let srcY = f32(outY) * params.scaleY;
  
  let x0 = u32(floor(srcX));
  let y0 = u32(floor(srcY));
  let x1 = min(x0 + 1u, params.inputWidth - 1u);
  let y1 = min(y0 + 1u, params.inputHeight - 1u);
  
  let fx = fract(srcX);
  let fy = fract(srcY);
  
  let p00 = textureLoad(inputTex, vec2<i32>(x0, y0), 0);
  let p01 = textureLoad(inputTex, vec2<i32>(x0, y1), 0);
  let p10 = textureLoad(inputTex, vec2<i32>(x1, y0), 0);
  let p11 = textureLoad(inputTex, vec2<i32>(x1, y1), 0);
  
  let result = mix(
    mix(p00, p10, fx),
    mix(p01, p11, fx),
    fy
  );
  
  textureStore(outputTex, vec2<i32>(outX, outY), result);
}
