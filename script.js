let model, chart;

document.getElementById("predictForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await loadModel(); // Load model if not yet loaded
  runPrediction();
});

async function loadModel() {
  if (!model) {
    model = await tf.loadLayersModel("tfjs_model/model.json");
    console.log("Model loaded!");
  }
}

async function runPrediction() {
  const targetPrice = parseFloat(document.getElementById("targetPrice").value);
  const targetTime = new Date(document.getElementById("targetTime").value);
  const now = new Date();
  const minutesAhead = Math.max(1, Math.floor((targetTime - now) / 60000));
  if (minutesAhead <= 0) return;

  const raw = await fetchKlines("1m", 60);
  const close = raw.map(d => parseFloat(d[4]));
  const currentPrice = close.at(-1);

  // === Preprocess for LSTM model ===
  const input = close.slice(-60).map(x => [x]); // shape: [60, 1]
  const tensorInput = tf.tensor(input).reshape([1, 60, 1]);
  const predictionTensor = model.predict(tensorInput);
  const predictedPrice = (await predictionTensor.data())[0];

  // === Basic Decision ===
  const prediction = predictedPrice >= targetPrice ? "Yes ✅" : "No ❌";
  const confidence = Math.min(99, Math.round(50 + Math.abs(predictedPrice - currentPrice) / currentPrice * 100));

  // === Output ===
  document.getElementById("result").innerHTML = `
    <p><b>Current Price:</b> ${currentPrice.toFixed(2)} USDT</p>
    <p><b>Predicted Price @ ${targetTime.toLocaleTimeString()}:</b> ${predictedPrice.toFixed(2)} USDT</p>
    <p><b>Prediction:</b> ${prediction}</p>
    <p><b>Confidence:</b> ${confidence}%</p>
    <canvas id="sparklineChart" height="50"></canvas>
  `;

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("sparklineChart"), {
    type: "line",
    data: {
      labels: raw.map(d => new Date(d[0]).toLocaleTimeString()),
      datasets: [{
        data: close,
        borderColor: "#00aaff",
        fill: false,
        tension: 0.3,
        pointRadius: 0
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { display: false } },
    }
  });

  tensorInput.dispose();
  predictionTensor.dispose();
}

// Fetch 1m candles
async function fetchKlines(interval, limit) {
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`);
  return await res.json();
}
