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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-900 text-green-400 font-mono min-h-screen flex flex-col items-center justify-center p-6">
        <h1 class="text-3xl sm:text-4xl font-bold text-cyan-400 mb-8">📊 Statistiques de la machine</h1>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-4xl">

            <div class="bg-gray-800 p-6 rounded-2xl shadow-md border border-green-700">
            <div class="flex items-center gap-3 text-xl">
                🧠 <span class="font-semibold">RAM utilisée</span>
            </div>
            <p class="mt-2 text-lg">${((mem.total - mem.available) / 1024 ** 2).toFixed(0)} / ${(mem.total / 1024 ** 2).toFixed(0)} Mo</p>
            <p class="text-sm text-green-300">(${((1 - mem.available / mem.total) * 100).toFixed(1)}%)</p>
            </div>

            <div class="bg-gray-800 p-6 rounded-2xl shadow-md border border-green-700">
            <div class="flex items-center gap-3 text-xl">
                📦 <span class="font-semibold">Cache & Buffers</span>
            </div>
            <p class="mt-2 text-lg">${(mem.buffers + mem.cached) / 1024 ** 2 | 0} Mo</p>
            </div>

            <div class="bg-gray-800 p-6 rounded-2xl shadow-md border border-green-700">
            <div class="flex items-center gap-3 text-xl">
                🖥️ <span class="font-semibold">Charge CPU</span>
            </div>
            <p class="mt-2 text-lg">${cpu.currentLoad.toFixed(1)}%</p>
            </div>

            <div class="bg-gray-800 p-6 rounded-2xl shadow-md border border-green-700">
            <div class="flex items-center gap-3 text-xl">
                💾 <span class="font-semibold">Disque utilisé</span>
            </div>
            <p class="mt-2 text-lg">${(disk[0].used / 1024 ** 3).toFixed(1)} / ${(disk[0].size / 1024 ** 3).toFixed(1)} Go</p>
            <p class="text-sm text-green-300">(${disk[0].use.toFixed(1)}%)</p>
            </div>

            <div class="bg-gray-800 p-6 rounded-2xl shadow-md border border-green-700 sm:col-span-2">
            <div class="flex items-center gap-3 text-xl">
                🌡️ <span class="font-semibold">Température</span>
            </div>
            <p class="mt-2 text-lg">${temperature}</p>
            </div>

        </div>
        </body>
        </html>
        `;

        res.send(html);
    } catch (error) {
        res.status(500).send("Erreur : " + error.message);
    }
});

app.listen(8084, () => {
    console.log("💻 Dashboard accessible sur http://localhost:8084");
});
