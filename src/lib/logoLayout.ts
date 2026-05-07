export type LogoLayout = "vertical" | "horizontal";

export const detectLogoLayout = (
  dataUrl: string,
): Promise<LogoLayout | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        resolve(null);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(null);
        return;
      }

      try {
        context.drawImage(img, 0, 0, width, height);
      } catch {
        const aspect = width / height;
        resolve(aspect >= 1 ? "horizontal" : "vertical");
        return;
      }

      let pixels: Uint8ClampedArray;
      try {
        pixels = context.getImageData(0, 0, width, height).data;
      } catch {
        // Cross-origin images may block pixel reads. Fall back to aspect ratio.
        const aspect = width / height;
        resolve(aspect >= 1 ? "horizontal" : "vertical");
        return;
      }
      const rowInk = new Array<number>(height).fill(0);
      const colInk = new Array<number>(width).fill(0);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const a = pixels[idx + 3];
          const isTransparent = a < 18;
          const isNearWhite = r > 246 && g > 246 && b > 246;
          if (isTransparent || isNearWhite) continue;
          rowInk[y] += 1;
          colInk[x] += 1;
        }
      }

      const scoreSplitStructure = (series: number[]) => {
        const n = series.length;
        if (n < 10) return 0;
        const maxInk = Math.max(...series);
        if (maxInk <= 0) return 0;

        const minSplit = Math.floor(n * 0.28);
        const maxSplit = Math.ceil(n * 0.72);
        const valleyWindow = Math.max(1, Math.floor(n * 0.02));
        let best = 0;

        for (let split = minSplit; split <= maxSplit; split++) {
          const leftPeak = Math.max(...series.slice(0, split));
          const rightPeak = Math.max(...series.slice(split));
          if (leftPeak <= 0 || rightPeak <= 0) continue;
          const valleyStart = Math.max(0, split - valleyWindow);
          const valleyEnd = Math.min(n, split + valleyWindow + 1);
          const valley = Math.min(...series.slice(valleyStart, valleyEnd));
          const raw = Math.min(leftPeak, rightPeak) - valley;
          if (raw > best) best = raw;
        }

        return best / maxInk;
      };

      const verticalStackScore = scoreSplitStructure(rowInk); // icon above text
      const horizontalSideScore = scoreSplitStructure(colInk); // icon beside text

      const rowStartTop = 0;
      const rowEndTop = Math.max(1, Math.floor(height * 0.45));
      const rowStartBottom = Math.min(height - 1, Math.floor(height * 0.55));
      const rowEndBottom = height;
      const spanRatioForRows = (startRow: number, endRow: number) => {
        let minX = width;
        let maxX = -1;
        for (let y = startRow; y < endRow; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const a = pixels[idx + 3];
            const isTransparent = a < 18;
            const isNearWhite = r > 246 && g > 246 && b > 246;
            if (isTransparent || isNearWhite) continue;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }
        }
        if (maxX < minX) return 0;
        return (maxX - minX + 1) / width;
      };
      const topSpanRatio = spanRatioForRows(rowStartTop, rowEndTop);
      const bottomSpanRatio = spanRatioForRows(rowStartBottom, rowEndBottom);
      const bottomMuchWiderThanTop = bottomSpanRatio > topSpanRatio + 0.18;
      const aspectRatio = width / height;

      if (
        horizontalSideScore >= 0.28 &&
        horizontalSideScore > verticalStackScore * 1.45 &&
        !bottomMuchWiderThanTop
      ) {
        resolve("horizontal");
        return;
      }

      if (
        (verticalStackScore >= 0.2 &&
          verticalStackScore > horizontalSideScore * 1.15) ||
        (bottomMuchWiderThanTop && verticalStackScore >= 0.12)
      ) {
        resolve("vertical");
        return;
      }

      if (
        aspectRatio >= 1.2 &&
        horizontalSideScore >= verticalStackScore * 0.72
      ) {
        resolve("horizontal");
        return;
      }

      if (
        aspectRatio <= 0.84 &&
        verticalStackScore >= horizontalSideScore * 0.72
      ) {
        resolve("vertical");
        return;
      }

      if (aspectRatio >= 1.38 && verticalStackScore < horizontalSideScore * 1.35) {
        resolve("horizontal");
        return;
      }

      if (aspectRatio <= 0.72 && horizontalSideScore < verticalStackScore * 1.35) {
        resolve("vertical");
        return;
      }

      resolve(null);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });

export const getPdfLogoTargetHeight = (layout: LogoLayout | null | undefined) =>
  layout === "vertical" ? 25 : 15;
