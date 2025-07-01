let model, chart;

document.getElementById("predictForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!model) {
    model = await tf.loadLayersModel("tfjs_model/model.json");
  }
  runMLPrediction();
});

async function runMLPrediction() {
  const targetPrice = parseFloat(document.getElementById("targetPrice").value);
  const targetTime = new Date(document.getElementById("targetTime").value);
  const now = new Date();

  const minutesAhead = Math.floor((targetTime - now) / 60000);
  if (minutesAhead <= 0 || minutesAhead > 60) {
    alert("Target time must be within 1–60 minutes from now.");
    return;
  }

  const candles = await fetchKlines("1m", 60);
  const closePrices = candles.map(d => parseFloat(d[4]));

  // Normalize prices
  const min = Math.min(...closePrices);
  const max = Math.max(...closePrices);
  const normalized = closePrices.map(p => (p - min) / (max - min));

  // Prepare input shape: [1, 60, 1]
  const inputTensor = tf.tensor(normalized.slice(-60)).reshape([1, 60, 1]);
  const prediction = model.predict(inputTensor);
  const predictedNormalized = await prediction.data();
  const predictedPrice = predictedNormalized[minutesAhead - 1] * (max - min) + min;

  // Generate Yes/No prediction
  const decision = predictedPrice >= targetPrice ? "Yes ✅" : "No ❌";
  const confidence = Math.min(99, Math.abs((predictedPrice - targetPrice) / targetPrice) * 100).toFixed(1);

  document.getElementById("result").innerHTML = `
    <p><b>Current Price:</b> ${closePrices.at(-1).toFixed(2)} USDT</p>
    <p><b>Predicted Price @ ${targetTime.toLocaleTimeString()}:</b> ${predictedPrice.toFixed(2)} USDT</p>
    <p><b>Prediction:</b> ${decision}</p>
    <p><b>Confidence:</b> ${confidence}%</p>
  `;

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("sparklineChart"), {
    type: "line",
    data: {
      labels: candles.map(d => new Date(d[0]).toLocaleTimeString()),
      datasets: [{
        label: "BTC/USDT",
        data: closePrices,
        borderColor: "#00aaff",
        fill: false,
        pointRadius: 0
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { display: true } }
    }
  });
}

async function fetchKlines(interval, limit) {
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`);
  return await res.json();
}
