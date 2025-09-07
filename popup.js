const API_KEY = "AIzaSyCMct9mGy7fNNGMgX7Ue1rC36zfEoi1dHI";
const TEXT_MODEL = "gemini-2.0-flash-exp";
const IMAGE_MODEL = "gemini-2.5-flash-image-preview"; 

const PANEL_WIDTH = 400;
const PANEL_HEIGHT = 300;
const MARGIN = 20;


document.getElementById('generateBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    const comicContainer = document.getElementById('comicContainer');
    comicContainer.innerHTML = "";
    statusDiv.innerText = "🌟 Generating comic...";

    // Use dropdown for style
    const style = document.getElementById('styleSelect').value;

    // Style-specific prompt additions
    let stylePrompt = "";
    if (style === "manhwa") {
        stylePrompt = `
Art style requirements:
- Clean, modern webtoon/manhwa illustration style
- Dynamic, cinematic panels with vibrant colors and strong contrast
- Clear composition, professional comic book quality
- No text, words, or speech bubbles in the image
- Single panel focus, not multi-panel layout
`;
    } else if (style === "ghibli") {
        stylePrompt = `
Art style requirements:
- Painterly, whimsical, and cinematic feel inspired by Studio Ghibli
- Soft lighting, emotional atmosphere, expressive characters
- Rich backgrounds, storybook quality
- No text, words, or speech bubbles in the image
- Single panel focus, not multi-panel layout
`;
    } else if (style === "minimalist") {
        stylePrompt = `
Art style requirements:
- Minimalist, flat design, infographic-like visuals
- Clean lines, simple color palette, high clarity
- Focus on clarity and visual storytelling
- No text, words, or speech bubbles in the image
- Single panel focus, not multi-panel layout
`;
    }

    chrome.storage.local.get(['newsText'], async (result) => {
        const newsText = result.newsText || '';
        if (!newsText) {
            statusDiv.innerText = "❌ No article found on this page!";
            return;
        }

        try {
            // 1. Generate story structure
            const storyPrompt = `
Convert this news article into a 4-panel webtoon comic structure. Make it engaging, visual, and accurate. The whole panel sequence should tell a coherent story.

Requirements for panel text:
- Use visual metaphors where possible 
- A vivid scene description for the image
- A short, natural character dialogue (max 20 words, no meta words like "Text Bubble" "Narrator", "Panel", or speaker names).
- Use only realistic, conversational dialogue as would appear in a real comic. Avoid anything that looks out of place in a comic.
- The whole panel sequence should tell a coherent story and it should make sense.


NEWS ARTICLE:
${newsText}

Return ONLY a valid JSON object with this exact structure:
{
"title": "Comic title",
"panels": [
  {"panel_number":1, "scene_description":"Detailed visual description", "dialogue":"Character dialogue", "characters":"Main characters", "mood":"Visual mood/tone"},
  {"panel_number":2, "scene_description":"Detailed visual description", "dialogue":"Character dialogue", "characters":"Main characters", "mood":"Visual mood/tone"},
  {"panel_number":3, "scene_description":"Detailed visual description", "dialogue":"Character dialogue", "characters":"Main characters", "mood":"Visual mood/tone"},
  {"panel_number":4, "scene_description":"Detailed visual description", "dialogue":"Character dialogue", "characters":"Main characters", "mood":"Visual mood/tone"}
]
}
`;

            const storyResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: storyPrompt }] }]
                })
            });

            if (!storyResponse.ok) throw new Error(`Story generation failed: ${storyResponse.status}`);
            const storyData = await storyResponse.json();
            const rawText = storyData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            const cleanedText = rawText.replace(/```json|```/g, "").trim();
            const story = JSON.parse(cleanedText);

            statusDiv.innerText = `🎨 Generating ${story.panels.length} panels...`;

            // 2. Generate images for each panel, show as they arrive in 2x2 grid
            const panelImages = [];
            comicContainer.innerHTML = "";
            comicContainer.style.display = "grid";
            comicContainer.style.gridTemplateColumns = "1fr 1fr";
            comicContainer.style.gridTemplateRows = "1fr 1fr";
            comicContainer.style.gap = "20px";
            comicContainer.style.width = "860px";
            comicContainer.style.height = "700px";
            comicContainer.style.margin = "0 auto";

            // Prepare empty slots in 2x2 grid
            for (let i = 0; i < 4; i++) {
                const panelDiv = document.createElement('div');
                panelDiv.style.width = PANEL_WIDTH + "px";
                panelDiv.style.height = (PANEL_HEIGHT + 60) + "px";
                panelDiv.style.background = "#eee";
                panelDiv.style.display = "flex";
                panelDiv.style.alignItems = "center";
                panelDiv.style.justifyContent = "center";
                panelDiv.style.position = "relative";
                panelDiv.innerText = `Panel ${i + 1}...`;
                comicContainer.appendChild(panelDiv);
            }

            // 2x2 grid positions: [0,1,2,3] = [top-left, top-right, bottom-left, bottom-right]
            const gridOrder = [0, 1, 2, 3];

            for (let i = 0; i < story.panels.length; i++) {
                const panel = story.panels[i];
                statusDiv.innerText = `🎨 Generating panel ${i + 1}/${story.panels.length}...`;

                // Compose image prompt with selected style
                const imagePrompt = `
Create a comic panel for a ${style.replace(/^\w/, c => c.toUpperCase())} style comic.

SCENE: ${panel.scene_description}
CHARACTERS: ${panel.characters}
MOOD: ${panel.mood}

Requirements:
- Maintain consistent recurring characters (faces, outfits, style) across all panels.
- Make scenes visually dynamic and engaging.
- Use visual metaphors where possible (e.g., empty battery = anxiety).

- Leave bottom 20% of image clear for speech bubble.

${stylePrompt}
`;

                // Call Gemini image model
                let base64img = null;
                let retries = 3;
                while (retries > 0 && !base64img) {
                    const imgResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${API_KEY}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: imagePrompt }] }]
                        })
                    });

                    if (!imgResponse.ok) throw new Error(`Image generation failed: ${imgResponse.status}`);
                    const imgData = await imgResponse.json();

                    const candidates = imgData.candidates || [];
                    for (const cand of candidates) {
                        const parts = cand.content?.parts || [];
                        for (const part of parts) {
                            if (part.inlineData && part.inlineData.mimeType.startsWith("image/")) {
                                base64img = part.inlineData.data;
                                break;
                            }
                        }
                        if (base64img) break;
                    }
                    if (!base64img) {
                        console.warn("No image data found, retrying... Panel:", i + 1, imgData);
                        retries--;
                        await new Promise(res => setTimeout(res, 1000)); // Wait 1s before retry
                    }
                }
                if (!base64img) throw new Error("No image data found for panel " + (i + 1));

                // Convert base64 to Image object
                const img = await loadImageFromBase64(base64img);
                panelImages.push({ img, dialogue: panel.dialogue, panel_number: panel.panel_number });

                // Draw panel with bubble on a canvas
                const panelCanvas = document.createElement('canvas');
                panelCanvas.width = PANEL_WIDTH;
                const bubbleHeight = getSpeechBubbleHeight(panel.dialogue, PANEL_WIDTH - 40, 20, "bold 16px Arial") + 30;
                panelCanvas.height = PANEL_HEIGHT + bubbleHeight;
                const ctx = panelCanvas.getContext('2d');
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, 0, panelCanvas.width, panelCanvas.height);

                ctx.drawImage(img, 0, 0, PANEL_WIDTH, PANEL_HEIGHT);

                // Border
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 3;
                ctx.strokeRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT);

                // Panel number badge
                ctx.fillStyle = "red";
                ctx.beginPath();
                ctx.arc(22, 22, 12, 0, 2 * Math.PI);
                ctx.fill();
                ctx.font = "bold 16px Arial";
                ctx.fillStyle = "#fff";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(panel.panel_number, 22, 22);

                // Draw speech bubble (auto-size)
                if (panel.dialogue && panel.dialogue.trim()) {
                    drawSpeechBubbleAuto(ctx, 20, PANEL_HEIGHT + 10, PANEL_WIDTH - 40, bubbleHeight - 20, panel.dialogue);
                }

                // Place in correct grid cell
                comicContainer.children[i].innerHTML = "";
                comicContainer.children[i].appendChild(panelCanvas);
            }

            // 3. Assemble final comic for download (as before)
            statusDiv.innerText = "🖼️ Assembling final comic...";
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = PANEL_WIDTH * 2 + MARGIN * 3;
            finalCanvas.height = (PANEL_HEIGHT + 60) * 2 + MARGIN * 3;
            const ctx = finalCanvas.getContext('2d');
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

            const positions = [
                [MARGIN, MARGIN],
                [MARGIN * 2 + PANEL_WIDTH, MARGIN],
                [MARGIN, MARGIN * 2 + PANEL_HEIGHT + 60],
                [MARGIN * 2 + PANEL_WIDTH, MARGIN * 2 + PANEL_HEIGHT + 60]
            ];

            for (let i = 0; i < panelImages.length; i++) {
                const panelCanvas = comicContainer.children[i].querySelector('canvas');
                const [x, y] = positions[i];
                ctx.drawImage(panelCanvas, x, y);
            }

            // 4. Show comic in popup (as before)
            comicContainer.innerHTML = "";
            const comicImg = document.createElement('img');
            comicImg.src = finalCanvas.toDataURL("image/png");
            comicImg.style.width = "100%";
            comicContainer.appendChild(comicImg);

            // Show share button
            const shareBtn = document.getElementById('shareBtn');
            shareBtn.style.display = 'block';
            shareBtn.onclick = async () => {
                const dataUrl = finalCanvas.toDataURL("image/png");
                // Try Web Share API with files (most mobile browsers)
                if (navigator.canShare && window.Blob) {
                    try {
                        const res = await fetch(dataUrl);
                        const blob = await res.blob();
                        const file = new File([blob], "webtoon_comic.png", { type: "image/png" });
                        await navigator.share({
                            files: [file],
                            title: "Webtoon Comic",
                            text: `Check out this comic: "${story.title}"`
                        });
                    } catch (err) {
                        alert("Sharing failed: " + err.message);
                    }
                } else {
                    // Fallback: copy image URL to clipboard
                    try {
                        await navigator.clipboard.writeText(dataUrl);
                        alert("Image link copied to clipboard! Paste it to share.");
                    } catch {
                        alert("Sharing not supported on this device.");
                    }
                }
            };

            // 5. Download button (as before)
            document.getElementById('downloadBtn').style.display = 'block';
            document.getElementById('downloadBtn').onclick = () => {
                const link = document.createElement('a');
                link.href = finalCanvas.toDataURL("image/png");
                link.download = "webtoon_comic.png";
                link.click();
            };

            statusDiv.innerText = `✅ Comic "${story.title}" generated!`;

        } catch (err) {
            console.error('Error:', err);
            statusDiv.innerText = "❌ Error generating comic. Check console for details.";
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('downloadBtn').style.display = 'none';
    document.getElementById('shareBtn').style.display = 'none';
});

// Helper: Load image from base64
function loadImageFromBase64(base64) {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = "data:image/png;base64," + base64;
    });
}

// Helper: Draw a simple speech bubble
function drawSpeechBubble(ctx, x, y, w, h, text) {
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 15);
    ctx.fill();
    ctx.stroke();


    // Draw text
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    wrapText(ctx, text, x + w / 2, y + h / 2, w - 20, 20);
    ctx.restore();
}

// Helper: Wrap text in speech bubble
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lines = [];
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line);
    const totalHeight = lines.length * lineHeight;
    let startY = y - totalHeight / 2 + lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i].trim(), x, startY + i * lineHeight);
    }
}

// Helper: Draw a speech bubble that auto-sizes to text
function drawSpeechBubbleAuto(ctx, x, y, maxWidth, maxHeight, text) {
    ctx.save();
    ctx.font = "bold 16px Arial";
    // Calculate lines and height
    const lines = [];
    let line = '';
    const words = text.split(' ');
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line);

    const bubbleHeight = lines.length * 20 + 20;
    // Draw bubble
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, maxWidth, bubbleHeight, 15);
    ctx.fill();
    ctx.stroke();


    // Draw text
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let startY = y + 10 + 10;
    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i].trim(), x + maxWidth / 2, startY + i * 20);
    }
    ctx.restore();
}

// Helper: Estimate bubble height for text
function getSpeechBubbleHeight(text, maxWidth, lineHeight, font) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    const words = text.split(' ');
    let line = '';
    let lines = [];
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line);
    return lines.length * lineHeight + 20;
}