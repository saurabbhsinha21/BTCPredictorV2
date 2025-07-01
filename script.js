<script>
let chart;

document.getElementById("predictForm").addEventListener("submit", (e) => {
  e.preventDefault();
  runPrediction();
  setInterval(runPrediction, 10000);
});

async function runPrediction() {
  const targetPrice = parseFloat(document.getElementById("targetPrice").value);
  const targetTime = new Date(document.getElementById("targetTime").value);
  const now = new Date();
  const minutesAhead = Math.max(1, Math.floor((targetTime - now) / 60000));
  if (minutesAhead <= 0) return;

  const [m1] = await Promise.all([
    fetchKlines("1m", 30)
  ]);

  const close1 = m1.map(d => parseFloat(d[4]));
  const open1 = m1.map(d => parseFloat(d[1]));
  const high1 = m1.map(d => parseFloat(d[2]));
  const low1 = m1.map(d => parseFloat(d[3]));
  const vol1 = m1.map(d => parseFloat(d[5]));

  const priceNow = close1.at(-1);
  const trendPerMin = (priceNow - close1[0]) / close1.length;
  let predictedPrice = priceNow + trendPerMin * minutesAhead;

  const ema1 = calculateEMA(close1.slice(-9));
  const rsiArray = close1.map((_, i, arr) => calculateRSI(arr.slice(0, i + 1)));
  const rsi1 = rsiArray.at(-1);

  const { macd, signal } = calculateMACD(close1);
  const macdSignal = macd - signal;

  const { upper, lower, middle } = calculateBollingerBands(close1);
  const pricePos = (priceNow > upper) ? "above" : (priceNow < lower) ? "below" : "inside";

  const avgVolume = vol1.reduce((a, b) => a + b) / vol1.length;
  const volumeSpike = vol1.at(-1) > avgVolume * 1.5;

  // Heiken Ashi
  const ha = [];
  for (let i = 0; i < close1.length; i++) {
    const o = i === 0 ? open1[0] : (ha[i - 1].o + ha[i - 1].c) / 2;
    const c = (open1[i] + high1[i] + low1[i] + close1[i]) / 4;
    const h = Math.max(high1[i], o, c);
    const l = Math.min(low1[i], o, c);
    ha.push({ o, h, l, c });
  }
  const haLast = ha.at(-1);

  // Candlestick strength
  const lastBody = Math.abs(close1.at(-1) - open1.at(-1));
  const lastWick = (high1.at(-1) - low1.at(-1)) - lastBody;
  const strongBullish = close1.at(-1) > open1.at(-1) && lastBody > lastWick;
  const strongBearish = close1.at(-1) < open1.at(-1) && lastBody > lastWick;
  if (strongBullish) predictedPrice += 20;
  if (strongBearish) predictedPrice -= 20;

  // ADX
  const { adx } = calculateADX(high1, low1, close1);
  let adxBoost = adx > 25 ? 15 : adx < 20 ? -10 : 0;

  // Trendline breakout
  const recentHigh = Math.max(...high1.slice(-6));
  const recentLow = Math.min(...low1.slice(-6));
  if (priceNow > recentHigh && volumeSpike) predictedPrice += 30;
  if (priceNow < recentLow && volumeSpike) predictedPrice -= 30;

  // ➕ EMA slope
  const emaSlope = ema1 - close1[close1.length - 10];

  // ➕ RSI recently oversold
  const rsiRecentlyOversold = rsiArray.slice(-5).some(r => r < 30);

  // ➕ BB distance
  const bbWidth = upper - lower;
  const bbDist = (priceNow - middle) / bbWidth;

  // ➕ Momentum
  const priceMomentum = priceNow - close1[close1.length - 10];
  const percentMomentum = (priceMomentum / close1[close1.length - 10]) * 100;

  // ➕ Volatility
  const avgRange = high1.map((h, i) => h - low1[i]).reduce((a, b) => a + b, 0) / high1.length;
  const volatilityIndex = avgRange / priceNow;

  // Apply influence to prediction
  if (emaSlope > 0) predictedPrice += 10;
  if (rsiRecentlyOversold) predictedPrice += 10;
  if (bbDist < -0.4) predictedPrice += 10;
  if (percentMomentum > 0.5) predictedPrice += 10;
  if (volatilityIndex > 0.015) predictedPrice += 5;

  // Final prediction and confidence
  const prediction = predictedPrice >= targetPrice ? "Yes ✅" : "No ❌";
  let confidence = 40;
  confidence += Math.min(30, Math.abs(trendPerMin * 1000));
  confidence += volumeSpike ? 10 : 5;
  confidence += (macdSignal > 0 ? 15 : 5);
  confidence += (rsi1 < 70 && rsi1 > 30 ? 10 : 5);
  confidence += (pricePos !== "inside" ? 15 : 5);
  confidence += adxBoost;
  confidence += (emaSlope > 0 ? 5 : 0);
  confidence += (rsiRecentlyOversold ? 5 : 0);
  confidence += (Math.abs(bbDist) > 0.4 ? 5 : 0);
  confidence += (percentMomentum > 0.5 ? 5 : 0);
  confidence += (volatilityIndex > 0.015 ? 5 : 0);
  confidence = Math.min(99, Math.max(40, Math.round(confidence)));

  // Explanation
  let explanation = `
    Heiken Ashi: ${haLast.c > haLast.o ? 'Bullish 📗' : 'Bearish 📕'}.<br>
    ${strongBullish ? "Strong Bullish Candle 🟢 +20.<br>" : ""}
    ${strongBearish ? "Strong Bearish Candle 🔴 -20.<br>" : ""}
    ADX: ${adx.toFixed(1)} (${adx > 25 ? "Strong trend +15" : adx < 20 ? "Choppy -10" : "Neutral"}).<br>
    RSI Oversold in last 5 mins: ${rsiRecentlyOversold ? "Yes ✅" : "No"}<br>
    EMA Slope: ${emaSlope.toFixed(2)}<br>
    BB Distance: ${bbDist.toFixed(2)}<br>
    10-min Momentum: ${percentMomentum.toFixed(2)}%<br>
    Volatility Index: ${(volatilityIndex * 100).toFixed(2)}%
  `;

  document.getElementById("result").innerHTML = `
    <p><b>Current Price:</b> ${priceNow.toFixed(2)} USDT</p>
    <p><b>Predicted Price @ ${targetTime.toLocaleTimeString()}:</b> ${predictedPrice.toFixed(2)} USDT</p>
    <p><b>Prediction:</b> <span class="${prediction.includes('Yes') ? 'prediction-yes' : 'prediction-no'}">${prediction}</span></p>
    <p class="confidence"><b>Confidence:</b> ${confidence}%</p>
    <hr>
    <p class="explanation">🧠 <b>Explanation:</b><br>${explanation}</p>
    <canvas id="sparklineChart" height="50"></canvas>
  `;

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("sparklineChart"), {
    type: "line",
    data: {
      labels: m1.map(d => new Date(d[0]).toLocaleTimeString()),
      datasets: [{
        data: close1,
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
}

// ===== Helper Functions =====
async function fetchKlines(interval, limit) {
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`);
  return await res.json();
}

function calculateEMA(prices, period = 9) {
  const k = 2 / (period + 1);
  return prices.reduce((acc, price, i) => i === 0 ? price : price * k + acc * (1 - k), 0);
}

function calculateRSI(prices, period = 14) {
  if (prices.length <= period) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period || 1e-6;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calculateMACD(prices) {
  const ema12 = calculateEMA(prices.slice(-26), 12);
  const ema26 = calculateEMA(prices.slice(-26), 26);
  const macd = ema12 - ema26;
  const signal = calculateEMA([macd], 9);
  return { macd, signal };
}

function calculateBollingerBands(prices, period = 20) {
  const sma = prices.reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / prices.length);
  return {
    upper: sma + 2 * stdDev,
    lower: sma - 2 * stdDev,
    middle: sma
  };
}

function calculateADX(highs, lows, closes, period = 14) {
  let tr = [], plusDM = [], minusDM = [];

  for (let i = 1; i < highs.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    plusDM.push(highs[i] - highs[i - 1] > lows[i - 1] - lows[i] ? Math.max(highs[i] - highs[i - 1], 0) : 0);
    minusDM.push(lows[i - 1] - lows[i] > highs[i] - highs[i - 1] ? Math.max(lows[i - 1] - lows[i], 0) : 0);
  }

  const tr14 = tr.slice(-period).reduce((a, b) => a + b, 0);
  const plusDM14 = plusDM.slice(-period).reduce((a, b) => a + b, 0);
  const minusDM14 = minusDM.slice(-period).reduce((a, b) => a + b, 0);

  const plusDI = 100 * (plusDM14 / tr14);
  const minusDI = 100 * (minusDM14 / tr14);
  const dx = 100 * Math.abs(plusDI - minusDI) / (plusDI + minusDI);
  return { adx: dx };
}
</script>
