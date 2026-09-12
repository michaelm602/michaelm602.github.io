import React from "react";

export default function PolicyAcknowledgementCheckbox({
    id,
    checked,
    onChange,
    label,
    description,
    describedBy,
    titleId,
}) {
    const checkmark = checked
        ? React.createElement(
            "svg",
            {
                viewBox: "0 0 20 20",
                fill: "none",
                className: "h-4 w-4 text-white",
                "aria-hidden": "true",
            },
            React.createElement("path", {
                d: "m4 10 4 4 8-9",
                stroke: "currentColor",
                strokeWidth: "2.5",
                strokeLinecap: "round",
                strokeLinejoin: "round",
            })
        )
        : null;

    return React.createElement(
        "label",
        {
            className:
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-sm py-1 text-left",
        },
        React.createElement("input", {
            id,
            type: "checkbox",
            checked,
            onChange,
            "aria-describedby": describedBy,
            className: "peer sr-only",
        }),
        React.createElement(
            "span",
            {
                className:
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-zinc-300 bg-transparent transition-colors peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-950",
                "aria-hidden": "true",
            },
            checkmark
        ),
        React.createElement(
            "span",
            { className: "min-w-0 flex-1 text-xs leading-relaxed text-zinc-200" },
            React.createElement(
                "span",
                { className: "flex flex-wrap items-center gap-2" },
                React.createElement(
                    "span",
                    { id: titleId, className: "font-semibold text-white" },
                    label
                ),
                checked
                    ? React.createElement(
                        "span",
                        {
                            className:
                                "inline-flex rounded-full border border-emerald-300/60 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100",
                        },
                        "Accepted"
                    )
                    : null
            ),
            description
                ? React.createElement(
                    "span",
                    { className: "mt-0.5 block text-zinc-400" },
                    description
                )
                : null
        )
    );
}
