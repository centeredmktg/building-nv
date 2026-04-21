/**
 * Jest mock for 'three' and 'three/webgpu'.
 *
 * VERSION-COUPLED to three@0.183.0 (as of Pascal@0.5.1). This stub provides
 * minimal Three.js exports to prevent WebGL/canvas errors when tests run in
 * Node. If Three.js is upgraded in Pascal's dependencies, verify that this
 * export list still covers the required classes and constants.
 *
 * Pascal's schemas dereference Three exports at module load time; without
 * this mock, schema imports fail in a headless environment.
 */
export const Color = class {};
export const Vector2 = class {};
export const Vector3 = class {};
export const Vector4 = class {};
export const Matrix2 = class {};
export const Matrix3 = class {};
export const Matrix4 = class {};
export const Euler = class {};
export const Quaternion = class {};
export const Mesh = class {};
export const MeshStandardMaterial = class {};
export const MeshStandardNodeMaterial = class {
  constructor(_params?: unknown) {}
};
export const BoxGeometry = class {};
export const Scene = class {};
export const Object3D = class {};
export const PerspectiveCamera = class {};
export const OrthographicCamera = class {};
export const WebGLRenderer = class {
  setSize() {}
  render() {}
};
export const TextureLoader = class {
  load() {
    return {};
  }
};
export const Texture = class {};
export const Group = class {};
export const BufferGeometry = class {};
export const BufferAttribute = class {};
export const Float32BufferAttribute = class {};
export const MeshBasicMaterial = class {};
export const LineBasicMaterial = class {};
export const Points = class {};
export const PointsMaterial = class {};
export const Loader = class {};
export const RepeatWrapping = 1000;
export const MirroredRepeatWrapping = 1002;
export const ClampToEdgeWrapping = 1001;
export const SRGBColorSpace = "srgb";
export const LinearSRGBColorSpace = "srgb-linear";
export const NoColorSpace = "";
export const DoubleSide = 2;
export const FrontSide = 0;
export const BackSide = 1;
export const NormalBlending = 1;
export const NoBlending = 0;
export const AddEquation = 100;
export const StaticDrawUsage = 35044;
export const DynamicDrawUsage = 35048;
export const UnsignedByteType = 1009;
export const FloatType = 1015;
export const HalfFloatType = 1016;
export const RGBAFormat = 1023;
export const LinearFilter = 1006;
export const NearestFilter = 1003;
export const LinearMipmapLinearFilter = 1008;
export const UVMapping = 300;
export const NoToneMapping = 0;
export const LinearToneMapping = 1;
export const SrcAlphaFactor = 204;
export const OneMinusSrcAlphaFactor = 205;
export const MathUtils = {
  generateUUID: () => "00000000-0000-0000-0000-000000000000",
  clamp: (v: number, min: number, max: number) => Math.max(min, Math.min(max, v)),
  degToRad: (d: number) => (d * Math.PI) / 180,
  radToDeg: (r: number) => (r * 180) / Math.PI,
};
export const ColorManagement = { enabled: false };
export const EventDispatcher = class {};
export const WebGPUCoordinateSystem = 2000;
export const WebGLCoordinateSystem = 2001;
export const REVISION = "999";
export default {
  MeshStandardNodeMaterial: class {
    constructor(_params?: unknown) {}
  },
  DoubleSide: 2,
  FrontSide: 0,
  BackSide: 1,
};
