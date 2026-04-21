"use client";

import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Viewer } from "@pascal-app/viewer";
import { useScene } from "@pascal-app/core";
import { seedDemoScene } from "./demo-scene";

export default function PascalViewer() {
  useEffect(() => {
    if (Object.keys(useScene.getState().nodes).length === 0) {
      seedDemoScene();
    }
  }, []);

  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [10, 10, 10], fov: 50 }} shadows>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <Viewer />
      </Canvas>
    </div>
  );
}
