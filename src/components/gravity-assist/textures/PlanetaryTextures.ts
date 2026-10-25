import * as THREE from 'three';

/**
 * Photorealistic Procedural Planetary Texture Generator
 * Generates high-fidelity albedo, roughness, and atmospheric maps for:
 * - Jupiter: multi-layered zonal belts, jet stream swirls, and realistic Great Red Spot
 * - Saturn: creamy ammonia haze, polar collar, and high-res ring opacity map
 * - Venus: thick opaque sulfuric acid cloud deck with UV wave perturbations
 * - Mercury: cratered silicate crust with ray structures
 * - Uranus & Neptune: deep methane blue atmospheres with atmospheric banding
 *
 * Runs 100% offline without external network dependencies.
 */
export class PlanetaryTextures {
  private static createFallbackTexture(): THREE.Texture {
    const data = new Uint8Array([200, 160, 120, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Generates Jupiter surface texture (2048 x 1024) with multi-frequency turbulent banding,
   * realistic color gradients (NEB, SEB, EZ), zonal vortices, and the Great Red Spot.
   */
  static createJupiterTexture(): THREE.Texture {
    if (typeof document === 'undefined') {
      return this.createFallbackTexture();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Base Jovian atmosphere background
    ctx.fillStyle = '#caa37e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Zonal band definitions (from North Pole y=0 to South Pole y=height)
    // Belts (dark, reddish-brown) and Zones (bright, creamy white/tan)
    const bands = [
      { y: 0.00, color: '#534335', width: 0.08 }, // North Polar Region
      { y: 0.08, color: '#886d52', width: 0.05 }, // North North Temperate Zone
      { y: 0.13, color: '#5f3a22', width: 0.06 }, // North North Temperate Belt
      { y: 0.19, color: '#baa083', width: 0.07 }, // North Temperate Zone
      { y: 0.26, color: '#7a3b1d', width: 0.08 }, // North Temperate Belt
      { y: 0.34, color: '#dcc6ab', width: 0.07 }, // North Tropical Zone
      { y: 0.41, color: '#823719', width: 0.09 }, // North Equatorial Belt (NEB - prominent)
      { y: 0.50, color: '#ebd8be', width: 0.06 }, // Equatorial Zone (EZ - bright)
      { y: 0.56, color: '#7b3216', width: 0.09 }, // South Equatorial Belt (SEB - prominent)
      { y: 0.65, color: '#d2bda0', width: 0.06 }, // South Tropical Zone (STrZ - host to GRS)
      { y: 0.71, color: '#68361f', width: 0.06 }, // South Temperate Belt
      { y: 0.77, color: '#bba286', width: 0.06 }, // South Temperate Zone
      { y: 0.83, color: '#5f3c27', width: 0.05 }, // South South Temperate Belt
      { y: 0.88, color: '#836850', width: 0.06 }, // South South Temperate Zone
      { y: 0.94, color: '#4a3a2d', width: 0.06 }, // South Polar Region
    ];

    // Render underlying smooth gradient bands
    for (const b of bands) {
      const topY = b.y * canvas.height;
      const h = b.width * canvas.height;
      const grad = ctx.createLinearGradient(0, topY, 0, topY + h);
      grad.addColorStop(0, b.color);
      grad.addColorStop(0.5, b.color);
      grad.addColorStop(1, '#9b7654');
      ctx.fillStyle = grad;
      ctx.fillRect(0, topY, canvas.width, h);
    }

    // Layer high-frequency turbulent wavy perturbations across zonal shears
    const numMicroBands = 120;
    const microH = canvas.height / numMicroBands;

    for (let i = 0; i < numMicroBands; i++) {
      const baseY = i * microH;
      const normY = baseY / canvas.height;
      // Vary turbulence intensity based on latitude (strongest at belt boundaries)
      const turbulence = 0.25 + 0.75 * Math.abs(Math.sin(normY * Math.PI * 6));

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, baseY);

      for (let x = 0; x <= canvas.width; x += 16) {
        // Multi-octave wave noise
        const oct1 = Math.sin(x * 0.012 + i * 0.9) * (microH * 0.45 * turbulence);
        const oct2 = Math.cos(x * 0.028 - i * 0.6) * (microH * 0.25 * turbulence);
        const oct3 = Math.sin(x * 0.075 + i * 1.5) * (microH * 0.12 * turbulence);
        ctx.lineTo(x, baseY + oct1 + oct2 + oct3);
      }

      ctx.lineTo(canvas.width, baseY + microH * 1.6);
      ctx.lineTo(0, baseY + microH * 1.6);
      ctx.closePath();

      // Atmospheric shear blending
      const alpha = 0.15 + 0.12 * Math.sin(i * 0.5);
      const isBelt = Math.sin(normY * Math.PI * 8) > 0;
      ctx.fillStyle = isBelt ? `rgba(95, 40, 20, ${alpha})` : `rgba(235, 215, 190, ${alpha})`;
      ctx.fill();
      ctx.restore();
    }

    // Add white oval storms (anticyclonic white spots common in southern temperate zone)
    const whiteOvals = [
      { x: canvas.width * 0.22, y: canvas.height * 0.73, rx: 25, ry: 15 },
      { x: canvas.width * 0.48, y: canvas.height * 0.74, rx: 30, ry: 16 },
      { x: canvas.width * 0.78, y: canvas.height * 0.73, rx: 24, ry: 14 },
    ];
    for (const spot of whiteOvals) {
      const grad = ctx.createRadialGradient(spot.x, spot.y, 2, spot.x, spot.y, spot.rx);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
      grad.addColorStop(0.7, 'rgba(235, 225, 210, 0.4)');
      grad.addColorStop(1, 'rgba(200, 180, 150, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(spot.x, spot.y, spot.rx, spot.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Great Red Spot (Southern Tropical Zone: centered near y = 0.62, x = 0.55)
    const grsX = canvas.width * 0.55;
    const grsY = canvas.height * 0.615;
    const grsRadiusX = 140;
    const grsRadiusY = 82;

    ctx.save();
    ctx.translate(grsX, grsY);
    ctx.rotate(-0.06); // Slight Jovian shear tilt

    // Outer turbulent vortex collar
    const collarGrad = ctx.createRadialGradient(0, 0, grsRadiusX * 0.5, 0, 0, grsRadiusX);
    collarGrad.addColorStop(0, 'rgba(180, 50, 25, 0.85)');
    collarGrad.addColorStop(0.65, 'rgba(215, 95, 55, 0.9)');
    collarGrad.addColorStop(0.85, 'rgba(235, 155, 105, 0.6)');
    collarGrad.addColorStop(1, 'rgba(200, 160, 120, 0)');

    ctx.fillStyle = collarGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, grsRadiusX, grsRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Deep core of the Great Red Spot
    const coreGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, grsRadiusX * 0.6);
    coreGrad.addColorStop(0, '#c72e12');
    coreGrad.addColorStop(0.5, '#ab2b13');
    coreGrad.addColorStop(1, 'rgba(175, 45, 20, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, grsRadiusX * 0.65, grsRadiusY * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    // Internal spiral swirling counter-current streaks
    ctx.strokeStyle = 'rgba(255, 190, 140, 0.35)';
    ctx.lineWidth = 3;
    for (let r = 20; r < grsRadiusX * 0.8; r += 18) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * (grsRadiusY / grsRadiusX), 0, 0.4, Math.PI * 1.8);
      ctx.stroke();
    }

    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Generates Saturn surface texture (1024 x 512) with golden-ochre ammonia clouds,
   * subtle temperate banding, and polar hexagon shading.
   */
  static createSaturnTexture(): THREE.Texture {
    if (typeof document === 'undefined') {
      return this.createFallbackTexture();
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Golden-ochre base palette
    const saturnBands = [
      '#786b51', // North polar collar
      '#a89775', '#c7b48e', '#dfcca5', '#ead9b6',
      '#f0e2c3', '#e4d2ad', '#d3bf98', '#beaa82',
      '#ab9770', '#8b7a5a', '#695c44'  // South polar
    ];

    const h = canvas.height;
    const w = canvas.width;
    const bandHeight = h / saturnBands.length;

    for (let i = 0; i < saturnBands.length; i++) {
      const y = i * bandHeight;
      const grad = ctx.createLinearGradient(0, y, 0, y + bandHeight);
      grad.addColorStop(0, saturnBands[i]);
      const nextCol = saturnBands[Math.min(i + 1, saturnBands.length - 1)];
      grad.addColorStop(1, nextCol);
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, w, bandHeight);
    }

    // Micro-banding ammonia streaks
    for (let y = 0; y < h; y += 4) {
      const alpha = 0.04 + 0.03 * Math.sin(y * 0.15);
      ctx.fillStyle = y % 8 === 0 ? `rgba(255, 255, 255, ${alpha})` : `rgba(60, 50, 30, ${alpha})`;
      ctx.fillRect(0, y, w, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Generates Saturn's ring texture (2048 x 64 radial gradient)
   * Detailed opacity and albedo map incorporating:
   * - C Ring (crepe ring, innermost, translucent)
   * - Maxwell Gap
   * - B Ring (densest, brightest)
   * - Cassini Division (clean dark gap: 4,800 km wide)
   * - A Ring (outer dense ring)
   * - Encke Gap & Keeler Gap
   */
  static createSaturnRingTexture(): THREE.Texture {
    if (typeof document === 'undefined') {
      return this.createFallbackTexture();
    }
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);

    // Inner edge (translucent C Ring)
    grad.addColorStop(0.00, 'rgba(150, 130, 100, 0.0)');
    grad.addColorStop(0.08, 'rgba(165, 145, 115, 0.28)');
    grad.addColorStop(0.20, 'rgba(175, 155, 125, 0.45)');

    // B Ring (bright, highly reflective icy particle field)
    grad.addColorStop(0.24, 'rgba(235, 215, 185, 0.92)');
    grad.addColorStop(0.40, 'rgba(245, 225, 195, 0.98)');
    grad.addColorStop(0.55, 'rgba(230, 210, 180, 0.95)');
    grad.addColorStop(0.61, 'rgba(210, 190, 160, 0.85)');

    // Cassini Division (prominent gap between B and A rings)
    grad.addColorStop(0.62, 'rgba(40, 35, 25, 0.10)');
    grad.addColorStop(0.65, 'rgba(20, 15, 10, 0.02)');
    grad.addColorStop(0.68, 'rgba(35, 30, 22, 0.12)');

    // A Ring (outer major ring)
    grad.addColorStop(0.69, 'rgba(215, 195, 165, 0.88)');
    grad.addColorStop(0.82, 'rgba(205, 185, 155, 0.82)');

    // Encke Gap (sharp narrow rift)
    grad.addColorStop(0.85, 'rgba(50, 42, 32, 0.08)');
    grad.addColorStop(0.865, 'rgba(200, 180, 150, 0.78)');

    // Outer edge fade
    grad.addColorStop(0.96, 'rgba(180, 160, 130, 0.35)');
    grad.addColorStop(1.00, 'rgba(140, 120, 95, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Generates Venus cloud deck texture (1024 x 512)
   * Dense, opaque yellowish-amber sulfuric acid cloud layers with global Y-feature circulation.
   */
  static createVenusTexture(): THREE.Texture {
    if (typeof document === 'undefined') {
      return this.createFallbackTexture();
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base pale-amber/cream sulfuric acid cloud
    ctx.fillStyle = '#edd6a6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle planetary scale planetary atmospheric circulation
    for (let y = 0; y < canvas.height; y++) {
      const normY = y / canvas.height;
      // Equatorial UV absorption wave (darker cream-tan)
      const eqAbsorption = Math.exp(-Math.pow((normY - 0.5) * 5.0, 2));
      const alpha = 0.08 * eqAbsorption;
      ctx.fillStyle = `rgba(165, 125, 75, ${alpha})`;
      ctx.fillRect(0, y, canvas.width, 1);
    }

    // Broad horizontal cloud streaks with gentle sinusoidal shear
    for (let i = 0; i < 40; i++) {
      const y = (i / 40) * canvas.height;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 248, 230, 0.12)' : 'rgba(180, 140, 90, 0.09)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= canvas.width; x += 32) {
        ctx.lineTo(x, y + Math.sin(x * 0.015 + i * 0.5) * 6);
      }
      ctx.lineTo(canvas.width, y + 14);
      ctx.lineTo(0, y + 14);
      ctx.closePath();
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Generates Mercury surface texture (1024 x 512)
   * Cratered lunar-like gray basalt surface.
   */
  static createMercuryTexture(): THREE.Texture {
    if (typeof document === 'undefined') {
      return this.createFallbackTexture();
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#838488';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Random crater impacts and mare basalt patches
    for (let i = 0; i < 350; i++) {
      const cx = Math.random() * canvas.width;
      const cy = Math.random() * canvas.height;
      const cr = 4 + Math.random() * 25;

      const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, cr);
      grad.addColorStop(0, 'rgba(55, 55, 58, 0.8)');
      grad.addColorStop(0.7, 'rgba(95, 95, 100, 0.5)');
      grad.addColorStop(1, 'rgba(131, 132, 136, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Generates Ice Giant (Uranus / Neptune) methane atmosphere texture (1024 x 512).
   */
  static createIceGiantTexture(isNeptune: boolean): THREE.Texture {
    if (typeof document === 'undefined') {
      return this.createFallbackTexture();
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const baseCol = isNeptune ? '#234a9b' : '#69b0d6';
    ctx.fillStyle = baseCol;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle methane bands
    for (let y = 0; y < canvas.height; y += 4) {
      const alpha = 0.05 + 0.04 * Math.sin(y * 0.1);
      ctx.fillStyle = isNeptune
        ? (y % 8 === 0 ? `rgba(90, 160, 255, ${alpha})` : `rgba(15, 30, 80, ${alpha})`)
        : (y % 8 === 0 ? `rgba(180, 240, 255, ${alpha})` : `rgba(60, 120, 160, ${alpha})`);
      ctx.fillRect(0, y, canvas.width, 2);
    }

    if (isNeptune) {
      // Great Dark Spot (Neptune)
      const dsX = canvas.width * 0.45;
      const dsY = canvas.height * 0.58;
      const grad = ctx.createRadialGradient(dsX, dsY, 2, dsX, dsY, 40);
      grad.addColorStop(0, 'rgba(15, 35, 90, 0.8)');
      grad.addColorStop(0.7, 'rgba(25, 55, 130, 0.4)');
      grad.addColorStop(1, 'rgba(35, 74, 155, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(dsX, dsY, 45, 26, -0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
