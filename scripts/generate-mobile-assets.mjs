import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const assetsDir = join(root, "apps", "mobile", "assets");

mkdirSync(assetsDir, { recursive: true });

function rgba(hex, alpha = 255) {
  const clean = hex.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
    alpha
  ];
}

function createCanvas(width, height, background = [0, 0, 0, 0]) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 4] = background[0];
    pixels[index * 4 + 1] = background[1];
    pixels[index * 4 + 2] = background[2];
    pixels[index * 4 + 3] = background[3];
  }
  return { width, height, pixels };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return;
  }
  const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  const alpha = color[3] / 255;
  const inverse = 1 - alpha;
  canvas.pixels[index] = Math.round(color[0] * alpha + canvas.pixels[index] * inverse);
  canvas.pixels[index + 1] = Math.round(color[1] * alpha + canvas.pixels[index + 1] * inverse);
  canvas.pixels[index + 2] = Math.round(color[2] * alpha + canvas.pixels[index + 2] * inverse);
  canvas.pixels[index + 3] = Math.min(255, Math.round(color[3] + canvas.pixels[index + 3] * inverse));
}

function drawRect(canvas, x, y, width, height, color) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(canvas, xx, yy, color);
    }
  }
}

function drawCircle(canvas, centerX, centerY, radius, color) {
  const minX = Math.floor(centerX - radius);
  const maxX = Math.ceil(centerX + radius);
  const minY = Math.floor(centerY - radius);
  const maxY = Math.ceil(centerY + radius);
  const radiusSquared = radius * radius;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radiusSquared) {
        setPixel(canvas, x, y, color);
      }
    }
  }
}

function drawRoundedRect(canvas, x, y, width, height, radius, color) {
  drawRect(canvas, x + radius, y, width - radius * 2, height, color);
  drawRect(canvas, x, y + radius, width, height - radius * 2, color);
  drawCircle(canvas, x + radius, y + radius, radius, color);
  drawCircle(canvas, x + width - radius, y + radius, radius, color);
  drawCircle(canvas, x + radius, y + height - radius, radius, color);
  drawCircle(canvas, x + width - radius, y + height - radius, radius, color);
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function drawPolygon(canvas, points, color) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.floor(Math.min(...xs));
  const maxX = Math.ceil(Math.max(...xs));
  const minY = Math.floor(Math.min(...ys));
  const maxY = Math.ceil(Math.max(...ys));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) {
        setPixel(canvas, x, y, color);
      }
    }
  }
}

function drawLine(canvas, x1, y1, x2, y2, thickness, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    drawCircle(canvas, x, y, thickness / 2, color);
  }
}

function drawStar(canvas, centerX, centerY, outerRadius, innerRadius, color) {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (Math.PI * i) / 5;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    points.push([centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius]);
  }
  drawPolygon(canvas, points, color);
}

function drawStudyMark(canvas, scale = 1, offsetX = 0, offsetY = 0) {
  const white = rgba("#F8FAFC", 245);
  const soft = rgba("#DBEAFE", 255);
  const teal = rgba("#14B8A6", 255);
  const navy = rgba("#102A43", 255);

  const transform = ([x, y]) => [offsetX + x * scale, offsetY + y * scale];
  const poly = (points, color) => drawPolygon(canvas, points.map(transform), color);

  poly(
    [
      [230, 380],
      [475, 450],
      [475, 730],
      [230, 655]
    ],
    white
  );
  poly(
    [
      [549, 450],
      [794, 380],
      [794, 655],
      [549, 730]
    ],
    soft
  );
  poly(
    [
      [475, 450],
      [512, 470],
      [549, 450],
      [549, 730],
      [512, 705],
      [475, 730]
    ],
    navy
  );
  drawLine(canvas, offsetX + 300 * scale, offsetY + 505 * scale, offsetX + 430 * scale, offsetY + 542 * scale, 18 * scale, teal);
  drawLine(canvas, offsetX + 596 * scale, offsetY + 542 * scale, offsetX + 726 * scale, offsetY + 505 * scale, 18 * scale, teal);
  drawLine(canvas, offsetX + 300 * scale, offsetY + 590 * scale, offsetX + 430 * scale, offsetY + 626 * scale, 18 * scale, teal);
  drawLine(canvas, offsetX + 596 * scale, offsetY + 626 * scale, offsetX + 726 * scale, offsetY + 590 * scale, 18 * scale, teal);
  drawStar(canvas, offsetX + 512 * scale, offsetY + 290 * scale, 72 * scale, 32 * scale, teal);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(canvas) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((canvas.width * 4 + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    const rawOffset = y * (canvas.width * 4 + 1);
    raw[rawOffset] = 0;
    canvas.pixels.copy(raw, rawOffset + 1, y * canvas.width * 4, (y + 1) * canvas.width * 4);
  }

  return Buffer.concat([header, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function savePng(name, canvas) {
  writeFileSync(join(assetsDir, name), encodePng(canvas));
}

const blue = rgba("#2563EB", 255);
const deep = rgba("#102A43", 255);
const pale = rgba("#F8FAFC", 255);
const transparent = rgba("#000000", 0);

const icon = createCanvas(1024, 1024, blue);
drawRoundedRect(icon, 122, 122, 780, 780, 112, rgba("#1E40AF", 255));
drawRoundedRect(icon, 168, 168, 688, 688, 84, rgba("#2563EB", 255));
drawStudyMark(icon);
savePng("icon.png", icon);

const adaptive = createCanvas(1024, 1024, transparent);
drawStudyMark(adaptive);
savePng("adaptive-icon.png", adaptive);

const splash = createCanvas(1024, 1024, transparent);
drawRoundedRect(splash, 172, 172, 680, 680, 96, deep);
drawStudyMark(splash);
savePng("splash-icon.png", splash);

const notification = createCanvas(192, 192, transparent);
drawPolygon(notification, [[42, 70], [90, 84], [90, 140], [42, 126]], rgba("#FFFFFF", 255));
drawPolygon(notification, [[102, 84], [150, 70], [150, 126], [102, 140]], rgba("#FFFFFF", 255));
drawLine(notification, 48, 94, 84, 104, 7, rgba("#FFFFFF", 255));
drawLine(notification, 108, 104, 144, 94, 7, rgba("#FFFFFF", 255));
drawStar(notification, 96, 48, 20, 9, rgba("#FFFFFF", 255));
savePng("notification-icon.png", notification);

const splashBackground = createCanvas(1242, 2436, pale);
drawRoundedRect(splashBackground, 321, 918, 600, 600, 96, deep);
drawStudyMark(splashBackground, 0.76, 233, 784);
savePng("splash.png", splashBackground);

console.log("Generated StudyNova mobile assets.");
