/* Калькулятор аэрозольного пожаротушения «Фумарола» — ПРОТОТИП.
 *
 * Помещения: список с индивидуальными габаритами.
 * Модели и их параметры (защищаемый объём, масса ГОА) — из каталога.
 * В расчёте участвуют только автономные и стационарные серии FR.
 * Удельные массы (q) и коэффициент запаса (K_зап) — ДЕМОНСТРАЦИОННЫЕ.
 * Коэффициент негерметичности задан: K_нег = 1.2.
 *
 * Экспорт результата — PDF с реквизитами компании (формируется в браузере).
 */
(function () {
  "use strict";

  // Реквизиты компании для PDF (из карточки компании). Пустые поля не выводятся.
  var COMPANY = {
    name: "ООО «Решение»",
    inn: "9723260529",
    kpp: "772301001",
    ogrn: "1257700406688",
    address: "г. Москва, вн.тер.г. муниципальный округ Южнопортовый, ул. Шарикоподшипниковская, д. 4 к. 4А, помещ. 12/2",
    bank: "Филиал «Нижегородский» АО «АЛЬФА-БАНК»",
    bik: "042202824",
    rs: "40702810829050015680",
    ks: "30101810200000000824",
    phone: "+7 968 000 10 86",
    email: "info@tdvostok.pro",
    site: "tdvostok.pro"
  };

  // Куда уходит заявка на цены. endpoint — необязательный URL (Formspree/Getform/CRM);
  // если пусто — откроется почтовый клиент на указанный e-mail.
  // Настройка получателя задаётся в общем конфиге страницы (window.FUMAROLA_REQUEST).
  var REQUEST = window.FUMAROLA_REQUEST || {
    email: "lobas.msk@yandex.ru",
    endpoint: "https://formsubmit.co/ajax/lobas.msk@yandex.ru"
  };

  var CFG = {
    demo: true,
    composition: "СТТ-25",
    safetyFactor: 1.0,
    leakFactor: { sealed: 1.0, leaky: 1.2, ventilation: 1.2 },
    specificMass: 0.04,
    models: [
      { id: "fr-2-5pt",  name: "FR-2.5PT",  massKg: 0.02,  volumeM3: 0.1, classes: ["A2","B","C","E"] },
      { id: "fr-5pt",    name: "FR-5PT",    massKg: 0.025, volumeM3: 0.2, classes: ["A2","B","C","E"] },
      { id: "fr-10",     name: "FR-10MT/ME/PT/PE",  massKg: 0.064, volumeM3: 0.4, classes: ["A2","B","C","E"] },
      { id: "fr-25",     name: "FR-25MT/ME/PT/PE",  massKg: 0.095, volumeM3: 1,   classes: ["A2","B","C","E"] },
      { id: "fr-50",     name: "FR-50MT/ME/PT/PE",  massKg: 0.134, volumeM3: 2,   classes: ["A2","B","C","E"] },
      { id: "fr-100",    name: "FR-100",    massKg: 0.21,  volumeM3: 4,  classes: ["A2","B","C","E"] },
      { id: "fr-150",    name: "FR-150MT/ME/PT/PE", massKg: 0.295, volumeM3: 6, classes: ["A2","B","C","E"] },
      { id: "fr-300",    name: "FR-300ME/MT/MTE",   massKg: 1.2,   volumeM3: 12, classes: ["A2","B","C","E"] },
      { id: "fr-500",    name: "FR-500ME/MT/MTE",   massKg: 1.35,  volumeM3: 20, classes: ["A2","B","C","E"] },
      { id: "fr-750",    name: "FR-750ME/MT/MTE",   massKg: 1.7,   volumeM3: 30, classes: ["A2","B","C","E"] },
      { id: "fr-1500",   name: "FR-1500ME/MT/MTE",  massKg: 2.435, volumeM3: 60, classes: ["A2","B","C","E"] }
    ]
  };

  var form = document.getElementById("fireCalc");
  if (!form) return;

  var steps = Array.prototype.slice.call(form.querySelectorAll(".calc-step"));
  var stepMarks = Array.prototype.slice.call(document.querySelectorAll(".calc-steps__item"));
  var resultBox = document.getElementById("calcResult");
  var roomsList = document.getElementById("roomsList");
  var current = 0;
  var started = false;
  var roomSeq = 0;
  var lastResult = null;

  // Логотип «Решение» для шапки PDF
  var logoImg = new Image();
  (function () {
    // data-URL из logo-data.js не «пачкает» canvas (важно при открытии по file://)
    if (window.FUMAROLA_LOGO) { logoImg.src = window.FUMAROLA_LOGO; return; }
    var el = document.querySelector('script[src$="calculator.js"]');
    var base = el ? el.getAttribute("src").replace(/calculator\.js.*$/, "") : "";
    logoImg.src = base + "assets/logo-reshenie.png";
  })();

  /* ===== Шаги ===== */
  function showStep(index) {
    current = Math.max(0, Math.min(steps.length - 1, index));
    steps.forEach(function (s, i) { s.classList.toggle("is-active", i === current); });
    stepMarks.forEach(function (m, i) {
      m.classList.toggle("is-active", i === current);
      m.classList.toggle("is-done", i < current);
    });
    if (started) {
      var top = document.getElementById("calcAnchor");
      if (top) top.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ===== Помещения ===== */
  function addRoom() {
    roomSeq++;
    var row = document.createElement("div");
    row.className = "room-row";
    row.innerHTML =
      '<div class="room-row__head">' +
        '<div class="form__field room-row__name"><label class="form__label">Назначение помещения</label>' +
          '<input class="form__input room-name" type="text" placeholder="например, серверная">' +
          '<p class="form__hint">Обозначьте назначение помещения, чтобы подобрать корректное решение. Примеры: серверная, электрощитовая, архив, склад ЛВЖ, кабельный коллектор, паркинг и т.д.</p></div>' +
        '<button type="button" class="room-remove" data-remove-room aria-label="Удалить помещение" title="Удалить помещение">×</button>' +
      "</div>" +
      '<div class="room-row__line">' +
        '<div class="form__field"><label class="form__label">Длина, м</label>' +
          '<input class="form__input room-l" type="number" min="0" step="0.1" placeholder="6"></div>' +
        '<div class="form__field"><label class="form__label">Ширина, м</label>' +
          '<input class="form__input room-w" type="number" min="0" step="0.1" placeholder="4"></div>' +
        '<div class="form__field"><label class="form__label">Высота, м</label>' +
          '<input class="form__input room-h" type="number" min="0" step="0.1" placeholder="3"></div>' +
      "</div>" +
      '<div class="room-row__line room-row__conds">' +
        '<div class="form__field"><label class="form__label">Герметичность</label>' +
          '<div class="calc-checks">' +
            '<label class="calc-check"><input type="radio" class="room-leak" name="leak-' + roomSeq + '" value="sealed"> герметичное</label>' +
            '<label class="calc-check"><input type="radio" class="room-leak" name="leak-' + roomSeq + '" value="leaky"> негерметичное</label>' +
            '<label class="calc-check"><input type="radio" class="room-leak" name="leak-' + roomSeq + '" value="ventilation"> с вентиляцией</label>' +
          "</div></div>" +
        '<div class="form__field"><label class="form__label">Постоянно люди</label>' +
          '<div class="calc-checks">' +
            '<label class="calc-check"><input type="radio" class="room-people" name="people-' + roomSeq + '" value="no"> нет</label>' +
            '<label class="calc-check"><input type="radio" class="room-people" name="people-' + roomSeq + '" value="yes"> да</label>' +
          "</div></div>" +
      "</div>";
    roomsList.appendChild(row);
    return row;
  }

  function roomRows() {
    return Array.prototype.slice.call(roomsList.querySelectorAll(".room-row"));
  }

  function getRooms() {
    return roomRows().map(function (row, i) {
      return {
        name: (row.querySelector(".room-name").value || "").trim() || ("Помещение " + (i + 1)),
        l: parseFloat(row.querySelector(".room-l").value),
        w: parseFloat(row.querySelector(".room-w").value),
        h: parseFloat(row.querySelector(".room-h").value),
        leak: (row.querySelector(".room-leak:checked") || {}).value || "",
        people: (row.querySelector(".room-people:checked") || {}).value || ""
      };
    });
  }

  function setRoomError(msg) {
    var e = document.getElementById("roomError");
    if (e) e.textContent = msg || "";
  }

  function validateRooms() {
    var rooms = getRooms();
    for (var i = 0; i < rooms.length; i++) {
      if (!(rooms[i].l > 0) || !(rooms[i].w > 0) || !(rooms[i].h > 0)) {
        setRoomError("Помещение «" + rooms[i].name + "»: укажите длину, ширину и высоту больше нуля.");
        return false;
      }
      if (!rooms[i].leak) {
        setRoomError("Помещение «" + rooms[i].name + "»: выберите герметичность.");
        return false;
      }
      if (!rooms[i].people) {
        setRoomError("Помещение «" + rooms[i].name + "»: укажите наличие людей.");
        return false;
      }
    }
    setRoomError("");
    return true;
  }

  function selectedClasses() {
    return Array.prototype.slice
      .call(form.querySelectorAll('input[name="fireClass"]:checked'))
      .map(function (c) { return c.value; });
  }

  function radioValue(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }

  function leakLabel(v) {
    return v === "leaky" ? "негерметичное" : (v === "ventilation" ? "с вентиляцией" : "герметичное");
  }

  /* ===== События ===== */
  form.addEventListener("click", function (event) {
    var t = event.target;

    if (t.matches("[data-add-room]")) { addRoom(); return; }

    if (t.matches("[data-remove-room]")) {
      var rows = roomRows();
      if (rows.length > 1) {
        t.closest(".room-row").remove();
      } else {
        var row = rows[0];
        row.querySelector(".room-l").value = "";
        row.querySelector(".room-w").value = "";
        row.querySelector(".room-h").value = "";
        Array.prototype.forEach.call(row.querySelectorAll(".room-leak, .room-people"), function (r) { r.checked = false; });
      }
      return;
    }

    if (t.matches("[data-next]")) {
      if (!validateRooms()) return;
      showStep(current + 1);
    }

    if (t.matches("[data-prev]")) { showStep(current - 1); }

    if (t.matches("[data-calc]")) {
      if (!validateRooms()) { showStep(0); return; }
      calculate();
    }

    if (t.matches("[data-export]")) { downloadPdf(); }

    if (t.matches("[data-request-prices]")) { showPriceRequest(); }
  });

  /* ===== Расчёт ===== */
  function calculate() {
    var rooms = getRooms();
    var kSafety = CFG.safetyFactor;
    var q = CFG.specificMass;

    var vols = rooms.map(function (r) { return r.l * r.w * r.h; });
    var leaks = rooms.map(function (r) { return CFG.leakFactor[r.leak] || 1.0; });
    var masses = vols.map(function (v, i) { return q * v * leaks[i] * kSafety; });
    var Vtotal = vols.reduce(function (a, b) { return a + b; }, 0);
    var Mtotal = masses.reduce(function (a, b) { return a + b; }, 0);

    var options = CFG.models.map(function (m) {
      var total = 0;
      for (var i = 0; i < vols.length; i++) {
        var nV = Math.ceil(vols[i] / m.volumeM3);
        var nM = Math.ceil(masses[i] / m.massKg);
        total += Math.max(nV, nM, 1);
      }
      return { model: m, total: total };
    });

    options.sort(function (a, b) {
      if (a.total !== b.total) return a.total - b.total;
      return a.model.volumeM3 - b.model.volumeM3;
    });
    var best = options.slice(0, 1)[0] || null;

    lastResult = {
      rooms: rooms, vols: vols, leaks: leaks, masses: masses,
      Vtotal: Vtotal, Mtotal: Mtotal,
      kSafety: kSafety, q: q, best: best,
      date: new Date()
    };

    var html = "";
    html += '<div class="calc-result__grid">';
    html += '<div class="calc-result__box"><div class="calc-result__label">Общий защищаемый объём</div><div class="calc-result__value">' + Vtotal.toFixed(1) + " м³</div></div>";
    html += '<div class="calc-result__box"><div class="calc-result__label">Требуемая масса состава (' + CFG.composition + ')</div><div class="calc-result__value calc-result__value--accent">' + Mtotal.toFixed(2) + " кг</div></div>";
    html += '<div class="calc-result__box"><div class="calc-result__label">Количество помещений</div><div class="calc-result__value">' + rooms.length + "</div></div>";
    html += '<div class="calc-result__box"><div class="calc-result__label">Учтено</div><div class="calc-result__value" style="font-size:1rem">q = ' + q + " кг/м³; K<sub>нег</sub> — по помещениям; K<sub>зап</sub> = " + kSafety.toFixed(1) + "</div></div>";
    html += "</div>";

    html += '<div class="calc-result__model"><div class="calc-result__label">Помещения</div><ul class="calc-options">';
    rooms.forEach(function (r, i) {
      var cond = leakLabel(r.leak) + (r.people === "yes" ? ", есть люди" : "");
      html += "<li><strong>" + r.name + "</strong> — " + vols[i].toFixed(1) + " м³ (" + cond + ")</li>";
    });
    html += "</ul></div>";

    if (best) {
      html += '<div class="calc-result__model"><div class="calc-result__label">Рекомендуемый вариант комплектации (предварительно)</div>';
      html += '<div class="calc-result__value calc-result__value--accent">' + best.model.name + " — " + best.total + " шт.</div>";
      html += '<p class="calc-result__label"><strong>Стоимость — по запросу.</strong> Нажмите «Получить цены» — пришлём цены и коммерческое предложение на этот комплект.</p>';
      html += '<p class="calc-result__label">Количество рассчитано по объёму и массе отдельно для каждого помещения. Итоговый подбор подтверждает специалист.</p></div>';
    } else {
      html += '<div class="calc-result__model"><div class="calc-result__label">Не удалось подобрать модель</div><p>Уточните класс пожара и оставьте заявку.</p></div>';
    }

    html += '<p class="calc-result__label" style="margin-top:16px">⚠️ Расчёт предварительный (демо-коэффициенты) и не является проектной документацией.</p>';

    var warns = [];
    var leakRooms = rooms.filter(function (r) { return (CFG.leakFactor[r.leak] || 1) > 1; });
    if (leakRooms.length) {
      warns.push("Негерметичные / с вентиляцией помещения (" + leakRooms.map(function (r) { return r.name; }).join(", ") + "): применён коэффициент негерметичности 1,2.");
    }
    var peopleRooms = rooms.filter(function (r) { return r.people === "yes"; });
    if (peopleRooms.length) {
      warns.push("Помещения с постоянным присутствием людей (" + peopleRooms.map(function (r) { return r.name; }).join(", ") + "): обеспечьте эвакуацию в течение 10 минут после срабатывания.");
    }
    if (warns.length > 0) {
      html += '<ul class="calc-warns">';
      warns.forEach(function (w) { html += "<li>" + w + "</li>"; });
      html += "</ul>";
    }

    resultBox.innerHTML = html;
    showStep(2);
  }

  /* ===== PDF: рендер отчёта в canvas ===== */
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    var words = String(text).split(" ");
    var line = "";
    for (var n = 0; n < words.length; n++) {
      var test = line ? line + " " + words[n] : words[n];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        y += lineHeight;
        line = words[n];
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, y);
    return y + lineHeight;
  }

  function renderReportCanvas() {
    var r = lastResult;
    var W = 1754;
    var pad = 70;
    var maxW = W - pad * 2;
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = 4000;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, canvas.height);
    ctx.textBaseline = "alphabetic";

    // Верхняя зелёная полоса бланка (full-bleed)
    var topH = Math.round(W * 360 / 2600);
    ctx.fillStyle = "#092316";
    ctx.fillRect(0, 0, W, topH);

    // Логотип и надпись «РЕШЕНИЕ»
    var logoH = Math.round(topH * 0.58);
    var wordX = 48;
    if (logoImg.complete && logoImg.naturalWidth) {
      var logoW = Math.round(logoImg.naturalWidth * logoH / logoImg.naturalHeight);
      ctx.drawImage(logoImg, 48, Math.round((topH - logoH) / 2), logoW, logoH);
      wordX = 48 + logoW + 28;
    }
    ctx.fillStyle = "#e3ab2e";
    ctx.font = "bold " + Math.round(topH * 0.30) + "px Arial, 'Segoe UI', sans-serif";
    ctx.fillText("РЕШЕНИЕ", wordX, Math.round(topH / 2 + topH * 0.105));

    // Реквизиты — по правому краю
    var reqLines = [
      "ООО «Решение»",
      "г. Москва, вн.тер.г. муниципальный округ Южнопортовый,",
      "ул. Шарикоподшипниковская, д. 4 к. 4А, помещ. 12/2",
      "ИНН 9723260529",
      "КПП 772301001",
      "Р/с 40702810829050015680",
      "БИК 042202824"
    ];
    ctx.font = Math.round(topH * 0.105) + "px Arial, 'Segoe UI', sans-serif";
    ctx.fillStyle = "#e3ab2e";
    var rlh = Math.round(topH * 0.135);
    var ry = Math.round((topH - reqLines.length * rlh) / 2 + rlh * 0.8);
    reqLines.forEach(function (line, i) {
      var w = ctx.measureText(line).width;
      ctx.fillText(line, W - 40 - w, ry + i * rlh);
    });

    // Контент
    var x = pad, y = topH + 44;

    // Заголовок
    ctx.fillStyle = "#111111";
    ctx.font = "bold 26px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("Расчёт аэрозольного пожаротушения «Фумарола»", x, y);
    y += 30;
    ctx.font = "15px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#555555";
    ctx.fillText("Дата: " + r.date.toLocaleString("ru-RU"), x, y);
    y += 40;

    // Параметры
    ctx.fillStyle = "#111111";
    ctx.font = "bold 19px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("Параметры расчёта", x, y);
    y += 26;
    ctx.font = "15px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#333333";
    var params = [
      "Удельная масса состава: " + r.q + " кг/м³;  коэффициент запаса: " + r.kSafety.toFixed(1),
      "Коэффициент негерметичности — по помещениям (1,0 / 1,2)"
    ];
    params.forEach(function (line) { ctx.fillText(line, x, y); y += 22; });
    y += 20;

    // Таблица помещений
    ctx.fillStyle = "#111111";
    ctx.font = "bold 19px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("Помещения", x, y);
    y += 26;

    var colX = [x, x + 50, x + 300, x + 600, x + 720, x + 850];
    var headers = ["№", "Название", "Габариты (Д×Ш×В), м", "Объём, м³", "Масса, кг", "Условия"];
    ctx.font = "bold 14px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#555555";
    headers.forEach(function (h, i) { ctx.fillText(h, colX[i], y); });
    y += 8;
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(W - pad, y); ctx.stroke();
    y += 22;

    ctx.font = "15px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#222222";
    r.rooms.forEach(function (room, i) {
      var dims = room.l + " × " + room.w + " × " + room.h;
      var cond = leakLabel(room.leak) + (room.people === "yes" ? ", люди" : "");
      ctx.fillText(String(i + 1), colX[0], y);
      ctx.fillText(room.name, colX[1], y);
      ctx.fillText(dims, colX[2], y);
      ctx.fillText(r.vols[i].toFixed(1), colX[3], y);
      ctx.fillText(r.masses[i].toFixed(2), colX[4], y);
      ctx.fillText(cond, colX[5], y);
      y += 22;
    });

    ctx.strokeStyle = "#cccccc";
    ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(W - pad, y - 14); ctx.stroke();
    ctx.font = "bold 15px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#111111";
    ctx.fillText("Итого", colX[1], y + 6);
    ctx.fillText(r.Vtotal.toFixed(1), colX[3], y + 6);
    ctx.fillText(r.Mtotal.toFixed(2), colX[4], y + 6);
    y += 50;

    // Рекомендуемый вариант
    ctx.fillStyle = "#111111";
    ctx.font = "bold 19px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("Рекомендуемый вариант комплектации", x, y);
    y += 28;
    if (r.best) {
      ctx.font = "bold 20px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#d9530f";
      ctx.fillText(r.best.model.name + " — " + r.best.total + " шт.", x, y);
      y += 26;
      ctx.font = "14px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#555555";
      y = wrapText(ctx, "Количество рассчитано по защищаемому объёму и массе состава отдельно для каждого помещения. Итоговый подбор подтверждает специалист.", x, y, maxW, 20);
    }
    y += 16;

    // Дисклеймер
    ctx.font = "13px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#777777";
    y = wrapText(ctx, "Расчёт предварительный, выполнен по демонстрационным коэффициентам и не является проектной документацией.", x, y, maxW, 19);

    // Нижняя зелёная полоса (в 2 раза тоньше верхней)
    var bottomH = Math.round(topH / 2);
    var pageH = Math.max(1240, Math.ceil(y + 36 + bottomH + 20));
    ctx.fillStyle = "#092316";
    ctx.fillRect(0, pageH - bottomH, W, bottomH);

    var usedH = pageH;

    // Обрезка по фактической высоте
    var out = document.createElement("canvas");
    out.width = W;
    out.height = usedH;
    var octx = out.getContext("2d");
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, W, usedH);
    octx.drawImage(canvas, 0, 0, W, usedH, 0, 0, W, usedH);
    return out;
  }

  /* ===== PDF: сборка файла ===== */
  function ascii(str) {
    var a = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) a[i] = str.charCodeAt(i) & 0xFF;
    return a;
  }

  function concatBytes(parts) {
    var len = 0;
    parts.forEach(function (p) { len += p.length; });
    var out = new Uint8Array(len);
    var o = 0;
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  }

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  function bytesToBase64(bytes) {
    var bin = "";
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  function pad10(n) {
    var s = String(n);
    while (s.length < 10) s = "0" + s;
    return s;
  }

  function buildPdfBytes() {
    var canvas = renderReportCanvas();
    var imgW = canvas.width;
    var imgH = canvas.height;
    var jpeg = base64ToBytes(canvas.toDataURL("image/jpeg", 0.92).split(",")[1]);

    var pageW = 841.89;
    var pageH = pageW * imgH / imgW;

    var chunks = [];
    var pos = 0;
    function add(bytes) { chunks.push(bytes); pos += bytes.length; }
    var offsets = {};
    function addObj(num, bodyParts) {
      offsets[num] = pos;
      add(ascii(num + " 0 obj\n"));
      bodyParts.forEach(add);
      add(ascii("\nendobj\n"));
    }

    add(ascii("%PDF-1.4\n"));
    add(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));

    addObj(1, [ascii("<< /Type /Catalog /Pages 2 0 R >>")]);
    addObj(2, [ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")]);
    addObj(3, [ascii("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageW.toFixed(2) + " " + pageH.toFixed(2) + "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>")]);
    addObj(4, [
      ascii("<< /Type /XObject /Subtype /Image /Width " + imgW + " /Height " + imgH +
        " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpeg.length + " >>\nstream\n"),
      jpeg,
      ascii("\nendstream")
    ]);
    var content = "q\n" + pageW.toFixed(2) + " 0 0 " + pageH.toFixed(2) + " 0 0 cm\n/Im0 Do\nQ\n";
    addObj(5, [
      ascii("<< /Length " + content.length + " >>\nstream\n"),
      ascii(content),
      ascii("\nendstream")
    ]);

    var xrefStart = pos;
    var count = 6;
    var xref = "xref\n0 " + count + "\n0000000000 65535 f \n";
    for (var i = 1; i < count; i++) {
      xref += pad10(offsets[i]) + " 00000 n \n";
    }
    add(ascii(xref));
    add(ascii("trailer\n<< /Size " + count + " /Root 1 0 R >>\nstartxref\n" + xrefStart + "\n%%EOF"));

    return concatBytes(chunks);
  }

  function downloadPdf() {
    if (!lastResult) return;
    var bytes = buildPdfBytes();
    var blob = new Blob([bytes], { type: "application/pdf" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "raschet-fumarola.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);

    // Визуальное подтверждение, что файл сохранён
    var btn = document.querySelector("[data-export]");
    if (btn) {
      var original = btn.getAttribute("data-orig") || btn.textContent;
      btn.setAttribute("data-orig", original);
      btn.textContent = "Сохранено в «Загрузки» ✓";
      window.setTimeout(function () { btn.textContent = original; }, 2500);
    }
  }

  /* ===== Заявка на цены ===== */
  function buildCalcSummary() {
    var r = lastResult;
    if (!r) return "";
    var lines = [];
    lines.push("Расчёт аэрозольного пожаротушения «Фумарола»");
    lines.push("Дата: " + r.date.toLocaleString("ru-RU"));
    lines.push("Удельная масса состава: " + r.q + " кг/м³; коэффициент запаса: " + r.kSafety.toFixed(1));
    lines.push("Помещения:");
    r.rooms.forEach(function (room, i) {
      lines.push("  " + (i + 1) + ") " + room.name + ": " + room.l + "×" + room.w + "×" + room.h +
        " м = " + r.vols[i].toFixed(1) + " м³; " + leakLabel(room.leak) +
        (room.people === "yes" ? ", есть люди" : "") + "; масса " + r.masses[i].toFixed(2) + " кг");
    });
    lines.push("Итого объём: " + r.Vtotal.toFixed(1) + " м³; масса: " + r.Mtotal.toFixed(2) + " кг");
    if (r.best) lines.push("Рекомендуемый комплект: " + r.best.model.name + " — " + r.best.total + " шт.");
    lines.push("");
    lines.push("Прошу сообщить стоимость и условия поставки.");
    return lines.join("\n");
  }

  function showPriceRequest() {
    if (!lastResult) return;

    var hidden = document.getElementById("reqCalculation");
    if (hidden) hidden.value = buildCalcSummary();

    var box = document.getElementById("calcRequestSummary");
    if (box) {
      var html = '<div class="calc-result"><div class="calc-result__label">Ваш расчёт</div><ul class="calc-options">';
      html += "<li>Общий объём: <strong>" + lastResult.Vtotal.toFixed(1) + " м³</strong>; масса состава: <strong>" + lastResult.Mtotal.toFixed(2) + " кг</strong></li>";
      if (lastResult.best) {
        html += "<li>Комплект: <strong>" + lastResult.best.model.name + " — " + lastResult.best.total + " шт.</strong></li>";
      }
      html += "<li>Помещений: " + lastResult.rooms.length + "</li>";
      html += "</ul></div>";
      box.innerHTML = html;
    }

    var sec = document.getElementById("calcRequest");
    if (sec) {
      sec.hidden = false;
      sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  var priceForm = document.getElementById("priceRequestForm");
  if (priceForm) {
    function setErr(id, msg) {
      var el = document.getElementById(id);
      if (el) el.textContent = msg || "";
    }

    priceForm.addEventListener("submit", function (event) {
      event.preventDefault();

      var name = document.getElementById("reqName").value.trim();
      var phone = document.getElementById("reqPhone").value.trim();
      var email = document.getElementById("reqEmail").value.trim();
      var consent = document.getElementById("reqConsent").checked;
      var status = document.getElementById("reqStatus");
      var ok = true;

      if (!name) { setErr("reqNameError", "Укажите имя."); ok = false; } else setErr("reqNameError", "");
      if (!phone) { setErr("reqPhoneError", "Укажите телефон."); ok = false; } else setErr("reqPhoneError", "");
      if (!email) {
        setErr("reqEmailError", "Укажите e-mail.");
        ok = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setErr("reqEmailError", "Проверьте формат e-mail.");
        ok = false;
      } else {
        setErr("reqEmailError", "");
      }
      if (!consent) { setErr("reqConsentError", "Необходимо согласие на обработку данных."); ok = false; } else setErr("reqConsentError", "");

      if (!ok) {
        status.className = "form__status is-error";
        status.textContent = "Проверьте выделенные поля.";
        return;
      }

      var calculation = document.getElementById("reqCalculation").value;
      var subject = "Заявка на цены — Фумарола";
      var body = calculation + "\n\nКонтакт:\nИмя: " + name + "\nТелефон: " + phone + (email ? "\nE-mail: " + email : "");

      status.className = "form__status";
      status.textContent = "Отправляем…";

      if (REQUEST.endpoint) {
        var honey = document.getElementById("reqHoney");
        var payload = {
          name: name,
          phone: phone,
          email: email,
          calculation: calculation,
          _subject: "Заявка на цены — Фумарола",
          _template: "table",
          _captcha: "false",
          _honey: honey ? honey.value : ""
        };
        if (email) payload._replyto = email;

        fetch(REQUEST.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload)
        }).then(function (resp) {
          return resp.json().catch(function () { return {}; });
        }).then(function (data) {
          if (data && (data.success === true || data.success === "true")) {
            status.className = "form__status is-success";
            status.textContent = "Спасибо! Заявка отправлена — пришлём цены и условия поставки.";
            priceForm.reset();
          } else if (data && /activat/i.test(data.message || "")) {
            status.className = "form__status is-error";
            status.textContent = "Форма ещё не активирована: подтвердите адрес в письме от FormSubmit на " + REQUEST.email + ".";
          } else {
            throw new Error("not success");
          }
        }).catch(function () {
          status.className = "form__status is-error";
          status.textContent = "Не удалось отправить. Напишите нам на " + REQUEST.email + ".";
        });
      } else {
        var href = "mailto:" + REQUEST.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
        window.location.href = href;
        status.className = "form__status is-success";
        status.textContent = "Открываем почтовый клиент. Если он не открылся, напишите на " + REQUEST.email + ".";
      }
    });
  }

  // Хук для проверок/интеграций
  window.FumarolaCalc = {
    buildPdfBase64: function () { return bytesToBase64(buildPdfBytes()); }
  };

  // Стартовое состояние
  addRoom();
  showStep(0);
  started = true;
})();
