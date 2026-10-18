import React, { useEffect, useRef } from 'react';
import { TelemetryPoint } from '../../../simulation/SimulationManager';

interface TelemetryChartsProps {
  history: TelemetryPoint[];
  isOpen: boolean;
  onToggle: () => void;
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({ history, isOpen, onToggle }) => {
  const altCanvasRef = useRef<HTMLCanvasElement>(null);
  const velCanvasRef = useRef<HTMLCanvasElement>(null);
  const energyCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isOpen || history.length < 2) return;

    drawChart(
      altCanvasRef.current,
      history.map((p) => p.timeS),
      history.map((p) => p.altitudeKm),
      'ALTITUDE',
      'km',
      '#38bdf8'
    );

    drawChart(
      velCanvasRef.current,
      history.map((p) => p.timeS),
      history.map((p) => p.speedMPerS),
      'INERTIAL SPEED',
      'm/s',
      '#fbbf24'
    );

    drawChart(
      energyCanvasRef.current,
      history.map((p) => p.timeS),
      history.map((p) => p.specificEnergyMJPerKg),
      'SPECIFIC ENERGY',
      'MJ/kg',
      '#c084fc'
    );
  }, [history, isOpen]);

  const drawChart = (
    canvas: HTMLCanvasElement | null,
    xData: number[],
    yData: number[],
    title: string,
    unit: string,
    lineColor: string
  ) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background & grid
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1a1f2c';
    ctx.lineWidth = 1;
    for (let y = 20; y < height - 15; y += 25) {
      ctx.beginPath();
      ctx.moveTo(35, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();
    }

    if (xData.length < 2) return;

    const xMin = xData[0];
    const xMax = Math.max(xData[xData.length - 1], xMin + 1.0);
    let yMin = Math.min(...yData);
    let yMax = Math.max(...yData);
    if (yMin === yMax) {
      yMin -= 1.0;
      yMax += 1.0;
    }

    const plotX = (x: number) => 35 + ((x - xMin) / (xMax - xMin)) * (width - 45);
    const plotY = (y: number) => (height - 20) - ((y - yMin) / (yMax - yMin)) * (height - 40);

    // Draw Line
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(plotX(xData[0]), plotY(yData[0]));
    for (let i = 1; i < xData.length; i++) {
      ctx.lineTo(plotX(xData[i]), plotY(yData[i]));
    }
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#8e96a4';
    ctx.font = '9px monospace';
    ctx.fillText(`${yMax.toFixed(0)}`, 4, 18);
    ctx.fillText(`${yMin.toFixed(0)}`, 4, height - 20);

    // Title & Latest Value
    const latestVal = yData[yData.length - 1];
    ctx.fillStyle = '#f0f2f6';
    ctx.font = '10px monospace';
    ctx.fillText(`${title}: ${latestVal.toFixed(1)} ${unit}`, 40, 14);
  };

  return (
    <div className="absolute top-4 right-4 z-20 pointer-events-auto flex flex-col items-end">
      <button
        onClick={onToggle}
        className="px-2.5 py-1.5 bg-[#0e1017]/85 backdrop-blur-md border border-[#232733] hover:border-neutral-500 rounded-xs text-[11px] font-mono text-neutral-300 transition-colors shadow-lg"
      >
        {isOpen ? 'HIDE CHARTS [x]' : 'TELEMETRY PLOTS [↑]'}
      </button>

      {isOpen && (
        <div className="mt-2 w-72 sm:w-80 bg-[#0e1017]/95 backdrop-blur-md border border-[#232733] p-3 rounded-sm shadow-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#232733] pb-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
              REAL-TIME PROFILES
            </span>
            <span className="text-[10px] font-mono text-neutral-500">
              {history.length} SAMPLES
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <canvas ref={altCanvasRef} width={300} height={90} className="w-full rounded-xs border border-[#1c202a]" />
            <canvas ref={velCanvasRef} width={300} height={90} className="w-full rounded-xs border border-[#1c202a]" />
            <canvas ref={energyCanvasRef} width={300} height={90} className="w-full rounded-xs border border-[#1c202a]" />
          </div>
        </div>
      )}
    </div>
  );
};
