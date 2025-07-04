const express = require('express');
const si = require('systeminformation');
const cron = require('node-cron');
const fs = require('fs');

const app = express();
const DATA_FILE = './data.json';

function getTemperature() {
    try {
        const tempStr = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8');
        return (parseInt(tempStr) / 1000).toFixed(1) + '°C';
    } catch (e) {
        return 'N/A';
    }
}

function saveDataPoint(dataPoint) {
    let history = [];

    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE);
            history = JSON.parse(raw);
        }
    } catch (e) {
        console.error("Erreur lecture data.json", e);
    }

    history.push(dataPoint);

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    history = history.filter(entry => new Date(entry.timestamp).getTime() > oneWeekAgo);

    fs.writeFileSync(DATA_FILE, JSON.stringify(history, null, 2));
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
        <h1 class="text-3xl sm:text-4xl font-bold text-cyan-400 mb-4">📊 Statistiques de la machine</h1>
        <a href="/graph" class="mb-8 inline-block bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded transition">
            Voir les graphiques
        </a>

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

app.get('/data', (req, res) => {
    try {
        const raw = fs.readFileSync(DATA_FILE);
        const data = JSON.parse(raw);
        res.json(data);
    } catch (e) {
        res.status(500).send("Erreur lecture des données");
    }
});

app.get('/graph', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>Graphiques - Statistiques</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body class="bg-gray-900 text-white p-6 font-mono">
        <h1 class="text-3xl text-cyan-400 mb-4">📈 Graphiques des dernières 24h</h1>
        <a href="/" class="inline-block mb-6 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition">
            Retour au dashboard
        </a>

        <div id="error" class="hidden mb-6 text-red-500 bg-red-100 p-4 rounded"></div>

        <canvas id="cpuChart" class="mb-10"></canvas>
        <canvas id="ramChart" class="mb-10"></canvas>
        <canvas id="tempChart" class="mb-10"></canvas>

        <script>
            async function loadAndRender() {
                try {
                    const res = await fetch('/data');

                    if (!res.ok) {
                        throw new Error('Impossible de récupérer les données (code HTTP ' + res.status + ')');
                    }

                    const data = await res.json();

                    const labels = data.map(d => new Date(d.timestamp).toLocaleTimeString());
                    const cpu = data.map(d => parseFloat(d.cpu));
                    const ram = data.map(d => parseFloat(d.ram));
                    const temp = data.map(d => parseFloat(d.temp));

                    new Chart(document.getElementById('cpuChart'), {
                        type: 'line',
                        data: {
                            labels,
                            datasets: [{ label: 'CPU %', data: cpu }]
                        }
                    });

                    new Chart(document.getElementById('ramChart'), {
                        type: 'line',
                        data: {
                            labels,
                            datasets: [{ label: 'RAM %', data: ram }]
                        }
                    });

                    new Chart(document.getElementById('tempChart'), {
                        type: 'line',
                        data: {
                            labels,
                            datasets: [{ label: 'Température °C', data: temp }]
                        }
                    });

                } catch (err) {
                    const errorDiv = document.getElementById('error');
                    errorDiv.textContent = '❌ Erreur lors du chargement des données : ' + err.message;
                    errorDiv.classList.remove('hidden');
                }
            }

            loadAndRender();
        </script>
    </body>
    </html>`;
    res.send(html);
});

app.listen(8084, () => {
    console.log("💻 Dashboard accessible sur http://localhost:8084");
    cron.schedule('0 * * * * *', async () => {
        try {
            const temperature = getTemperature();
            const [cpu, mem, disk] = await Promise.all([
                si.currentLoad(),
                si.mem(),
                si.fsSize()
            ]);

            saveDataPoint({
                timestamp: new Date().toISOString(),
                cpu: cpu.currentLoad.toFixed(1),
                ram: ((mem.total - mem.available) / mem.total * 100).toFixed(1),
                disk: ((disk[0].used / disk[0].size) * 100).toFixed(1),
                temp: temperature
            });

            console.log("✔️ Stats enregistrées à", new Date().toLocaleString());
        } catch (e) {
            console.error("❌ Erreur enregistrement stats", e);
        }
    });
});
