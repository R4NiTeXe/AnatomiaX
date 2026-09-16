/**
 * STEP 8.30 ambient medical-tech backdrop shaders.
 * Raw WebGL1 + procedural GLSL only — no textures, no postprocessing, no
 * three.js dependency. The fullscreen triangle keeps vertex work trivial;
 * all visuals live in the fragment shader at low alpha so text contrast
 * is never at risk.
 */

export const BACKDROP_VERTEX = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/**
 * Restraint budget (alpha peaks, before the u_intensity scale):
 * - teal glow <= 0.10, violet glow <= 0.08
 * - grid lines 0.05, scan sweep 0.05, grain +/-0.006
 * Movement is low-frequency (slowest period ~14s). Time frozen entirely
 * under reduced motion — the caller renders one static frame instead.
 */
export const BACKDROP_FRAGMENT = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float t = u_time;

  // Slow opposing drift keeps the field alive without visible looping.
  vec2 driftA = vec2(sin(t * 0.11) * 0.08, cos(t * 0.09) * 0.06);
  vec2 driftB = vec2(cos(t * 0.07 + 1.7) * 0.09, sin(t * 0.08 + 0.6) * 0.07);

  vec2 toTeal = p - driftA + vec2(0.28, 0.12);
  vec2 toViolet = p - driftB - vec2(0.30, -0.14);
  float teal = exp(-dot(toTeal, toTeal) * 3.2);
  float violet = exp(-dot(toViolet, toViolet) * 3.8);

  vec3 col = vec3(0.18, 0.83, 0.75) * teal * 0.10;
  col += vec3(0.55, 0.45, 0.95) * violet * 0.08;

  // Fine static measurement grid, radially masked to the center.
  float mask = exp(-dot(p, p) * 2.6);
  vec2 cell = abs(fract(gl_FragCoord.xy / 46.0) - 0.5);
  float gridLine = smoothstep(0.46, 0.5, min(cell.x, cell.y));
  col += vec3(0.45, 0.75, 0.85) * gridLine * 0.05 * mask;

  // One soft scan band (~14s period), same mask so edges stay calm.
  float sweepPos = fract(t * 0.07) * 1.4 - 0.2;
  float sweep = exp(-pow((uv.y - sweepPos) * 6.0, 2.0));
  col += vec3(0.40, 0.90, 0.85) * sweep * 0.05 * mask;

  // Dither against gradient banding; static when time is frozen.
  col += (hash(gl_FragCoord.xy + fract(t) * 7.0) - 0.5) * 0.012;

  // Vignette: fade to fully transparent at the frame edges.
  float edge = smoothstep(0.75, 0.25, length(p));
  float alpha = clamp(dot(col, vec3(1.0)) * 1.2, 0.0, 0.85);

  gl_FragColor = vec4(col * u_intensity * edge, alpha * u_intensity * edge);
}
`;
