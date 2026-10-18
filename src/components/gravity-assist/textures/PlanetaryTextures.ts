import * as THREE from 'three';

/**
 * Procedural Planetary Texture Generator
 * Generates high-resolution textures for Jupiter (atmospheric bands & Great Red Spot),
 * Saturn (creamy golden cloud bands & ring opacity map), Earth, and Venus without external network dependencies.
 */
export class PlanetaryTextures {
  /**
   * Generates Jupiter surface texture with distinct belts, zones, and Great Red Spot
   */
  static createJupiterTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Base background
    ctx.fillStyle = '#c8a47e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Color palette for Jovian bands (North/South Equatorial Belts, Temperate zones)
    const bandColors = [
      '#a26c48', '#d6b38c', '#8c5233', '#e4cbb0', '#7a4225',
      '#d9bc99', '#5e321a', '#e8d4be', '#8f5737', '#caa783',
      '#663a20', '#dfcca9', '#7f492b', '#d2b591', '#9a6442'
    ];

    // Draw horizontal atmospheric bands with sinusoidal wave perturbations
    const numBands = 80;
    const bandHeight = canvas.height / numBands;

    for (let i = 0; i < numBands; i++) {
      const y = i * bandHeight;
      const colorIndex = Math.floor(Math.abs(Math.sin(i * 0.45)) * bandColors.length) % bandColors.length;
      ctx.fillStyle = bandColors[colorIndex];
      ctx.beginPath();
      ctx.moveTo(0, y);

      for (let x = 0; x <= canvas.width; x += 32) {
        // Turbulent ripple effect
        const wave1 = Math.sin(x * 0.015 + i * 0.8) * (bandHeight * 0.35);
        const wave2 = Math.cos(x * 0.035 - i * 0.5) * (bandHeight * 0.2);
        ctx.lineTo(x, y + wave1 + wave2);
      }
      ctx.lineTo(canvas.width, y + bandHeight * 1.5);
      ctx.lineTo(0, y + bandHeight * 1.5);
      ctx.closePath();
      ctx.fill();
    }

    // Great Red Spot (Southern Hemisphere: around y = 620, x = 1100)
    const grsX = canvas.width * 0.55;
    const grsY = canvas.height * 0.62;
    const radiusX = 110;
    const radiusY = 65;

    const grsGrad = ctx.createRadialGradient(grsX, grsY, 5, grsX, grsY, radiusX);
    grsGrad.addColorStop(0, '#c34125');
    grsGrad.addColorStop(0.5, '#ad3219');
    grsGrad.addColorStop(0.85, '#e49071');
    grsGrad.addColorStop(1, 'rgba(200, 164, 126, 0)');

    ctx.save();
    ctx.translate(grsX, grsY);
    ctx.rotate(-0.08); // Slight planetary shear
    ctx.scale(1, radiusY / radiusX);
    ctx.fillStyle = grsGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Generates Saturn surface texture with smooth golden-ochre bands
   */
  static createSaturnTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const saturnColors = [
      '#e5cca3', '#ceb084', '#dfc49a', '#c7a97b',
      '#ebd5b3', '#d6b88d', '#e0c59e', '#c1a273'
    ];

    const h = canvas.height;
    const w = canvas.width;

    for (let y = 0; y < h; y++) {
      const normY = y / h;
      const bandIdx = Math.floor(normY * saturnColors.length) % saturnColors.length;
      const baseCol = saturnColors[bandIdx];
      ctx.fillStyle = baseCol;
      ctx.fillRect(0, y, w, 1);

      // Subtle atmospheric noise
      if (Math.sin(y * 0.1) > 0.3) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(0, y, w, 1);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Generates Saturn's ring texture (radial opacity and colors for Cassini division, A, B, C rings)
   */
  static createSaturnRingTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Horizontal gradient across canvas represents radial distance from inner to outer edge
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);

    // C Ring (innermost, semi-transparent)
    grad.addColorStop(0.0, 'rgba(160, 140, 110, 0.0)');
    grad.addColorStop(0.12, 'rgba(170, 150, 120, 0.35)');
    grad.addColorStop(0.25, 'rgba(180, 160, 130, 0.55)');

    // B Ring (brightest, densest)
    grad.addColorStop(0.28, 'rgba(230, 210, 180, 0.95)');
    grad.addColorStop(0.55, 'rgba(215, 195, 165, 0.98)');
    grad.addColorStop(0.65, 'rgba(225, 205, 175, 0.90)');

    // Cassini Division (dark gap)
    grad.addColorStop(0.66, 'rgba(30, 25, 20, 0.08)');
    grad.addColorStop(0.71, 'rgba(25, 20, 15, 0.04)');

    // A Ring (outer ring)
    grad.addColorStop(0.72, 'rgba(200, 185, 155, 0.85)');
    grad.addColorStop(0.88, 'rgba(190, 175, 145, 0.80)');
    // Encke Gap
    grad.addColorStop(0.89, 'rgba(50, 40, 30, 0.15)');
    grad.addColorStop(0.91, 'rgba(190, 175, 145, 0.75)');

    // Outer edge fade
    grad.addColorStop(0.98, 'rgba(170, 155, 125, 0.4)');
    grad.addColorStop(1.0, 'rgba(150, 135, 105, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }
}
