const express = require('express');
const si = require('systeminformation');
const fs = require('fs');
const app = express();

function getTemperature() {
    try {
        const tempStr = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8');
        return (parseInt(tempStr) / 1000).toFixed(1) + '°C';
    } catch (e) {
        return 'N/A';
    }
}

app.get('/', async (req, res) => {
    try {
        const [cpu, mem, disk] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.fsSize()
        ]);

        const temperature = getTemperature();

        const html = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Stats Raspberry Pi</title>
            <meta http-equiv="refresh" content="2">
            <style>
                body { font-family: sans-serif; background: #111; color: #0f0; text-align: center; padding: 2em; }
                h1 { color: #0ff; }
                .stat { font-size: 1.5em; margin-top: 1em; }
            </style>
        </head>
        <body>
            <h1>📊 Statistiques de la machine</h1>
            <div class="stat">🧠 RAM utilisée : ${((mem.total - mem.available) / 1024 ** 2).toFixed(0)} / ${(mem.total / 1024 ** 2).toFixed(0)} Mo (${((1 - mem.available / mem.total) * 100).toFixed(1)}%)</div>
            <div class="stat">📦 Cache + buffers : ${(mem.buffers + mem.cached) / 1024 ** 2 | 0} Mo</div>
            <div class="stat">🖥️ CPU : ${cpu.currentLoad.toFixed(1)}%</div>
            <div class="stat">💾 Disque : ${(disk[0].used / 1024 ** 3).toFixed(1)} / ${(disk[0].size / 1024 ** 3).toFixed(1)} Go (${disk[0].use.toFixed(1)}%)</div>
            <div class="stat">🌡️ Température : ${temperature}</div>
        </body>
        </html>
        `;

        res.send(html);
    } catch (error) {
        res.status(500).send("Erreur : " + error.message);
    }
});

app.listen(3000, () => {
    console.log("💻 Dashboard accessible sur http://localhost:3000");
});
