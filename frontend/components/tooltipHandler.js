let tooltipElement;

function initializeTooltip() {
    tooltipElement = document.createElement("div");
    tooltipElement.className = "tooltip";
    tooltipElement.style.display = "none";
    tooltipElement.style.position = "fixed";
    tooltipElement.style.backgroundColor = "rgba(74, 144, 226, 1)" ;
    tooltipElement.style.color = "#eeeeee";
    tooltipElement.style.padding = "8px 12px";
    tooltipElement.style.borderRadius = "5px";
    tooltipElement.style.fontSize = "11px";
    tooltipElement.style.zIndex = "1000";

    // Add CSS for the triangle
    tooltipElement.style.setProperty("--triangle-size", "7px");
    tooltipElement.style.setProperty("--tooltip-color", "rgba(74, 144, 226, 1)");

    // Add the ::after pseudo-element for the triangle
    const triangle = document.createElement("style");
    triangle.textContent = `
        .tooltip::after {
            content: "";
            position: absolute;
            top: 100%;
            left: 60%;
            margin-left: calc(var(--triangle-size) * -1);
            border-width: var(--triangle-size);
            border-style: solid;
            border-color: var(--tooltip-color) transparent transparent transparent;
        }
    `;
    document.head.appendChild(triangle);
    document.body.appendChild(tooltipElement);
}

function showTooltip(element, message) {
    const rect = element.getBoundingClientRect();
    tooltipElement.textContent = message;
    tooltipElement.style.display = "block";

    const top = rect.top - tooltipElement.offsetHeight - 12; 
    const left = rect.right - tooltipElement.offsetWidth;

    tooltipElement.style.top = `${top + window.scrollY}px`;
    tooltipElement.style.left = `${left + window.scrollX}px`;
}

function hideTooltip() {
    tooltipElement.style.display = "none";
}

export default {
    init: initializeTooltip,
    show: showTooltip,
    hide: hideTooltip
};