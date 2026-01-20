import React, { useState } from "react";

const colors = [
    "#f44336", "#e91e63", "#9c27b0", "#673ab7",
    "#3f51b5", "#2196f3", "#03a9f4", "#009688",
    "#4caf50", "#ff9800", "#795548", "#607d8b"
];

const getColor = (name = "") => {
    const hash = name
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

const Avatar = ({ name, src, size = 40 }) => {
    const [imgError, setImgError] = useState(false);

    // Если нет src или произошла ошибка загрузки
    if (!src || imgError) {
        return (
            <div
                style={{
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    background: getColor(name),
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: size * 0.45,
                    userSelect: "none",
                }}
            >
                {name?.[0]?.toUpperCase() || "?"}
            </div>
        );
    }

    // Если src есть и загрузилось успешно
    return (
        <img
            src={src}
            alt={name}
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                objectFit: "cover",
            }}
            onError={() => setImgError(true)} // <- ловим 404 и переключаем на fallback
        />
    );
};

export default Avatar;