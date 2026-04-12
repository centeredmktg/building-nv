"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Stage, Layer, Line, Rect, Text, Circle, Image as KonvaImage, Group } from "react-konva";
import Toolbar, { type Tool } from "./Toolbar";
import SidePanel from "./SidePanel";
import { exportToPdf } from "@/lib/floor-plan-export";
import type { CanvasData, Wall } from "@/lib/floor-plan-types";

interface Props {
  floorPlanId: string;
  initialName: string;
  projectName: string | null;
  initialCanvasData: CanvasData;
  sourceImageUrl: string | null;
  extractionNotes: string[];
}

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;

export default function FloorPlanEditor({
  floorPlanId,
  initialName,
  projectName,
  initialCanvasData,
  sourceImageUrl,
  extractionNotes,
}: Props) {
  const stageRef = useRef<any>(null);
  const [canvasData, setCanvasData] = useState<CanvasData>(initialCanvasData);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBackground, setShowBackground] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);

  const [history, setHistory] = useState<CanvasData[]>([initialCanvasData]);
  const [historyIndex, setHistoryIndex] = useState(0);

  useEffect(() => {
    if (!sourceImageUrl) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = sourceImageUrl;
    img.onload = () => setBackgroundImage(img);
  }, [sourceImageUrl]);

  const pushHistory = useCallback((newData: CanvasData) => {
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), newData]);
    setHistoryIndex((prev) => prev + 1);
    setCanvasData(newData);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setCanvasData(history[newIndex]);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setCanvasData(history[newIndex]);
  }, [history, historyIndex]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) { e.preventDefault(); redo(); return; }
      if (e.key === "z" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); undo(); return; }
      if (e.key === "v") setActiveTool("select");
      if (e.key === "d") setActiveTool("editDimension");
      if (e.key === "l") setActiveTool("addLabel");
      if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedId) handleDelete(selectedId);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, selectedId]);

  function handleDelete(id: string) {
    const newData = {
      ...canvasData,
      walls: canvasData.walls.filter((w) => w.id !== id),
      rooms: canvasData.rooms.filter((r) => r.id !== id),
      dimensions: canvasData.dimensions.filter((d) => d.id !== id),
      openings: canvasData.openings.filter((o) => o.id !== id),
      labels: canvasData.labels.filter((l) => l.id !== id),
    };
    pushHistory(newData);
    setSelectedId(null);
  }

  function handleWallDragEnd(wallId: string, dx: number, dy: number) {
    const newData = {
      ...canvasData,
      walls: canvasData.walls.map((w) =>
        w.id === wallId ? { ...w, x1: w.x1 + dx, y1: w.y1 + dy, x2: w.x2 + dx, y2: w.y2 + dy } : w
      ),
    };
    pushHistory(newData);
  }

  function handleWallEndpointDrag(wallId: string, endpoint: "start" | "end", x: number, y: number) {
    const grid = canvasData.gridSize;
    const snappedX = Math.round(x / grid) * grid;
    const snappedY = Math.round(y / grid) * grid;
    const newData = {
      ...canvasData,
      walls: canvasData.walls.map((w) => {
        if (w.id !== wallId) return w;
        return endpoint === "start"
          ? { ...w, x1: snappedX, y1: snappedY }
          : { ...w, x2: snappedX, y2: snappedY };
      }),
    };
    pushHistory(newData);
  }

  function handleDimensionClick(dimId: string) {
    if (activeTool !== "editDimension") return;
    const dim = canvasData.dimensions.find((d) => d.id === dimId);
    if (!dim) return;
    const newValue = prompt(`Enter new measurement (${dim.unit}):`, String(dim.length));
    if (newValue === null) return;
    const parsed = parseFloat(newValue);
    if (isNaN(parsed) || parsed <= 0) return;
    const newData = {
      ...canvasData,
      dimensions: canvasData.dimensions.map((d) =>
        d.id === dimId ? { ...d, length: parsed } : d
      ),
    };
    pushHistory(newData);
  }

  function handleStageClick(e: any) {
    if (activeTool !== "addLabel") return;
    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;
    const text = prompt("Enter label text:");
    if (!text) return;
    const newData = {
      ...canvasData,
      labels: [...canvasData.labels, {
        id: `label_${Date.now()}`,
        text,
        x: pos.x,
        y: pos.y,
        fontSize: 14,
      }],
    };
    pushHistory(newData);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const stage = stageRef.current;
      const thumbnailUrl = stage?.toDataURL({ pixelRatio: 0.3 }) ?? null;
      await fetch(`/api/floor-plans/${floorPlanId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasData, thumbnailUrl }),
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleExportPng() {
    const stage = stageRef.current;
    if (!stage) return;
    const wasVisible = showBackground;
    if (wasVisible) setShowBackground(false);
    setTimeout(() => {
      const dataUrl = stage.toDataURL({ pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `${initialName.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
      if (wasVisible) setShowBackground(true);
    }, 100);
  }

  function handleExportPdf() {
    const stage = stageRef.current;
    if (!stage) return;
    const wasVisible = showBackground;
    if (wasVisible) setShowBackground(false);
    setTimeout(() => {
      const dataUrl = stage.toDataURL({ pixelRatio: 2 });
      const pdf = exportToPdf(dataUrl, CANVAS_WIDTH, CANVAS_HEIGHT, initialName, projectName);
      pdf.save(`${initialName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
      if (wasVisible) setShowBackground(true);
    }, 100);
  }

  function wallMidpoint(wall: Wall) {
    return { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 };
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        showBackground={showBackground}
        onToggleBackground={() => setShowBackground(!showBackground)}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex items-center justify-center bg-bg p-4 overflow-auto">
          <Stage
            ref={stageRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={handleStageClick}
            style={{ border: "1px solid var(--color-border)", background: "#1a1a1a" }}
          >
            {/* Grid layer */}
            <Layer>
              {Array.from({ length: Math.floor(CANVAS_WIDTH / canvasData.gridSize) + 1 }).map((_, i) => (
                <Line
                  key={`gv-${i}`}
                  points={[i * canvasData.gridSize, 0, i * canvasData.gridSize, CANVAS_HEIGHT]}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={1}
                />
              ))}
              {Array.from({ length: Math.floor(CANVAS_HEIGHT / canvasData.gridSize) + 1 }).map((_, i) => (
                <Line
                  key={`gh-${i}`}
                  points={[0, i * canvasData.gridSize, CANVAS_WIDTH, i * canvasData.gridSize]}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={1}
                />
              ))}
            </Layer>

            {/* Background image layer */}
            {showBackground && backgroundImage && (
              <Layer opacity={0.3}>
                <KonvaImage
                  image={backgroundImage}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                />
              </Layer>
            )}

            {/* Rooms layer */}
            <Layer>
              {canvasData.rooms.map((room) => (
                <Group key={room.id}>
                  <Line
                    points={room.points.flatMap((p) => [p.x, p.y])}
                    closed
                    fill={room.fillColor}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={1}
                    onClick={() => activeTool === "select" && setSelectedId(room.id)}
                  />
                  {room.label && (() => {
                    const cx = room.points.reduce((s, p) => s + p.x, 0) / room.points.length;
                    const cy = room.points.reduce((s, p) => s + p.y, 0) / room.points.length;
                    return (
                      <Text
                        x={cx - 30}
                        y={cy - 6}
                        text={room.label}
                        fontSize={12}
                        fill="rgba(255,255,255,0.6)"
                        align="center"
                        width={60}
                      />
                    );
                  })()}
                </Group>
              ))}
            </Layer>

            {/* Walls layer */}
            <Layer>
              {canvasData.walls.map((wall) => (
                <Group key={wall.id}>
                  <Line
                    points={[wall.x1, wall.y1, wall.x2, wall.y2]}
                    stroke={selectedId === wall.id ? "#C17F3A" : "#F5F2ED"}
                    strokeWidth={wall.thickness}
                    hitStrokeWidth={20}
                    draggable={activeTool === "select"}
                    onClick={() => activeTool === "select" && setSelectedId(wall.id)}
                    onDragEnd={(e) => {
                      const node = e.target;
                      handleWallDragEnd(wall.id, node.x(), node.y());
                      node.position({ x: 0, y: 0 });
                    }}
                  />
                  {selectedId === wall.id && activeTool === "select" && (
                    <>
                      <Circle
                        x={wall.x1}
                        y={wall.y1}
                        radius={5}
                        fill="#C17F3A"
                        draggable
                        onDragEnd={(e) => handleWallEndpointDrag(wall.id, "start", e.target.x(), e.target.y())}
                      />
                      <Circle
                        x={wall.x2}
                        y={wall.y2}
                        radius={5}
                        fill="#C17F3A"
                        draggable
                        onDragEnd={(e) => handleWallEndpointDrag(wall.id, "end", e.target.x(), e.target.y())}
                      />
                    </>
                  )}
                </Group>
              ))}
            </Layer>

            {/* Openings layer */}
            <Layer>
              {canvasData.openings.map((opening) => {
                const wall = canvasData.walls.find((w) => w.id === opening.wallId);
                if (!wall) return null;
                const ox = wall.x1 + (wall.x2 - wall.x1) * opening.position;
                const oy = wall.y1 + (wall.y2 - wall.y1) * opening.position;
                return (
                  <Group key={opening.id}>
                    <Rect
                      x={ox - 8}
                      y={oy - 8}
                      width={16}
                      height={16}
                      fill={opening.type === "door" ? "rgba(192, 132, 72, 0.5)" : "rgba(100, 149, 237, 0.5)"}
                      stroke={selectedId === opening.id ? "#C17F3A" : "rgba(255,255,255,0.3)"}
                      strokeWidth={1}
                      onClick={() => activeTool === "select" && setSelectedId(opening.id)}
                    />
                    <Text
                      x={ox - 4}
                      y={oy - 4}
                      text={opening.type === "door" ? "D" : "W"}
                      fontSize={8}
                      fill="#F5F2ED"
                    />
                  </Group>
                );
              })}
            </Layer>

            {/* Dimensions layer */}
            <Layer>
              {canvasData.dimensions.map((dim) => {
                const wall = canvasData.walls.find((w) => w.id === dim.wallId);
                if (!wall) return null;
                const mid = wallMidpoint(wall);
                return (
                  <Text
                    key={dim.id}
                    x={mid.x + dim.offsetX - 20}
                    y={mid.y + dim.offsetY}
                    text={`${dim.length} ${dim.unit}`}
                    fontSize={11}
                    fill={selectedId === dim.id ? "#C17F3A" : "rgba(255,255,255,0.8)"}
                    padding={2}
                    onClick={() => {
                      if (activeTool === "select") setSelectedId(dim.id);
                      handleDimensionClick(dim.id);
                    }}
                    width={40}
                    align="center"
                  />
                );
              })}
            </Layer>

            {/* Labels layer */}
            <Layer>
              {canvasData.labels.map((label) => (
                <Text
                  key={label.id}
                  x={label.x}
                  y={label.y}
                  text={label.text}
                  fontSize={label.fontSize}
                  fill={selectedId === label.id ? "#C17F3A" : "#F5F2ED"}
                  draggable={activeTool === "select"}
                  onClick={() => activeTool === "select" && setSelectedId(label.id)}
                  onDragEnd={(e) => {
                    const newData = {
                      ...canvasData,
                      labels: canvasData.labels.map((l) =>
                        l.id === label.id ? { ...l, x: e.target.x(), y: e.target.y() } : l
                      ),
                    };
                    pushHistory(newData);
                  }}
                />
              ))}
            </Layer>
          </Stage>
        </div>

        <SidePanel
          name={initialName}
          projectName={projectName}
          onSave={handleSave}
          onExportPng={handleExportPng}
          onExportPdf={handleExportPdf}
          isSaving={isSaving}
          extractionNotes={extractionNotes}
        />
      </div>
    </div>
  );
}
