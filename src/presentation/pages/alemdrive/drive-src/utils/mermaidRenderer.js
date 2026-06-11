import mermaid from 'mermaid';

let initialized = false;

const ensureMermaid = () => {
    if (initialized) return;
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'neutral',
        fontFamily: 'inherit',
    });
    initialized = true;
};

/**
 * @param {string} chartText
 * @returns {Promise<string>}
 */
export async function renderMermaidSvg(chartText) {
    const text = (chartText || '').trim();
    if (!text) {
        throw new Error('Пустая диаграмма');
    }

    ensureMermaid();
    const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
    const { svg } = await mermaid.render(id, text);
    return svg;
}

const parseSvgDimensions = (svgString) => {
    const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) {
        return { width: 800, height: 600 };
    }

    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
        const parts = viewBox.trim().split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            return { width: parts[2], height: parts[3] };
        }
    }

    const width = parseFloat(svg.getAttribute('width')) || 800;
    const height = parseFloat(svg.getAttribute('height')) || 600;
    return { width: Math.max(width, 1), height: Math.max(height, 1) };
};

const normalizeSvgString = (svgString) => {
    const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) {
        throw new Error('Диаграмма ещё не отрисована');
    }

    const { width, height } = parseSvgDimensions(svgString);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!svg.getAttribute('width')) svg.setAttribute('width', String(width));
    if (!svg.getAttribute('height')) svg.setAttribute('height', String(height));
    return new XMLSerializer().serializeToString(svg);
};

/**
 * @param {string} svgHtml
 * @param {string} [filename]
 */
export async function downloadMermaidDiagramAsPngFromSvg(svgHtml, filename = 'mermaid-diagram.png') {
    if (!svgHtml?.trim()) {
        throw new Error('Диаграмма ещё не отрисована');
    }

    const svgString = normalizeSvgString(svgHtml);
    const { width, height } = parseSvgDimensions(svgString);
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

    await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const scale = 2;
                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil(width * scale);
                canvas.height = Math.ceil(height * scale);
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Не удалось создать canvas'));
                    return;
                }
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.scale(scale, scale);
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Не удалось сформировать PNG'));
                        return;
                    }
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
                    link.click();
                    URL.revokeObjectURL(url);
                    resolve();
                }, 'image/png');
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = () => reject(new Error('Не удалось подготовить изображение'));
        img.src = svgUrl;
    });
}

/** @deprecated Use renderMermaidSvg + dangerouslySetInnerHTML in React */
export async function renderMermaidDiagram(container, chartText) {
    const svg = await renderMermaidSvg(chartText);
    if (container) {
        container.innerHTML = svg;
    }
}

/** @deprecated Use downloadMermaidDiagramAsPngFromSvg */
export async function downloadMermaidDiagramAsPng(container, filename = 'mermaid-diagram.png') {
    const svg = container?.querySelector('svg');
    if (!svg) {
        throw new Error('Диаграмма ещё не отрисована');
    }
    const svgString = new XMLSerializer().serializeToString(svg);
    return downloadMermaidDiagramAsPngFromSvg(svgString, filename);
}
