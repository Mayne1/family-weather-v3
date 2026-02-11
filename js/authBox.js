export function renderAuthBox(targetId, text) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.textContent = text || "";
}

