/* Фумарола — базовая логика страницы */
(function () {
  "use strict";

  /* ===== Мобильное меню ===== */
  var navToggle = document.getElementById("navToggle");
  var nav = document.getElementById("primaryNav");

  if (navToggle && nav) {
    function setMenu(open) {
      nav.classList.toggle("is-open", open);
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    }

    navToggle.addEventListener("click", function () {
      setMenu(!nav.classList.contains("is-open"));
    });

    // Закрытие меню после выбора пункта
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        setMenu(false);
      }
    });

    // Закрытие по клику вне области меню
    document.addEventListener("click", function (event) {
      if (!nav.classList.contains("is-open")) return;
      if (nav.contains(event.target) || navToggle.contains(event.target)) return;
      setMenu(false);
    });

    // Закрытие по Escape
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setMenu(false);
      }
    });

    // При возврате на широкий экран сбрасываем состояние
    window.addEventListener("resize", function () {
      if (window.innerWidth > 760) {
        setMenu(false);
      }
    });
  }

  /* ===== Форма «Получить консультацию» ===== */
  var form = document.getElementById("consultForm");

  if (form) {
    var fields = {
      name: document.getElementById("name"),
      phone: document.getElementById("phone"),
      email: document.getElementById("email"),
      consent: document.getElementById("consent")
    };

    var statusEl = document.getElementById("formStatus");
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function setError(input, message) {
      if (!input) return;
      var wrap = input.closest(".form__field");
      var errorEl = document.getElementById(input.id + "Error");

      if (message) {
        if (wrap) wrap.classList.add("is-invalid");
        if (errorEl) errorEl.textContent = message;
        input.setAttribute("aria-invalid", "true");
      } else {
        if (wrap) wrap.classList.remove("is-invalid");
        if (errorEl) errorEl.textContent = "";
        input.removeAttribute("aria-invalid");
      }
    }

    function validate() {
      var ok = true;

      if (!fields.name.value.trim()) {
        setError(fields.name, "Укажите имя.");
        ok = false;
      } else {
        setError(fields.name, "");
      }

      if (!fields.phone.value.trim()) {
        setError(fields.phone, "Укажите телефон для связи.");
        ok = false;
      } else {
        setError(fields.phone, "");
      }

      var email = fields.email.value.trim();
      if (email && !emailPattern.test(email)) {
        setError(fields.email, "Проверьте формат e-mail.");
        ok = false;
      } else {
        setError(fields.email, "");
      }

      if (!fields.consent.checked) {
        setError(fields.consent, "Необходимо согласие на обработку данных.");
        ok = false;
      } else {
        setError(fields.consent, "");
      }

      return ok;
    }

    // Очищаем ошибку по мере исправления поля
    Object.keys(fields).forEach(function (key) {
      var input = fields[key];
      if (!input) return;
      var evt = key === "consent" ? "change" : "input";
      input.addEventListener(evt, function () {
        setError(input, "");
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      statusEl.className = "form__status";
      statusEl.textContent = "";

      if (!validate()) {
        statusEl.className = "form__status is-error";
        statusEl.textContent = "Проверьте выделенные поля.";
        var firstInvalid = form.querySelector(".is-invalid .form__input, .is-invalid input");
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      var cfg = window.FUMAROLA_REQUEST || {};
      var submitBtn = form.querySelector('button[type="submit"]');
      var origText = submitBtn ? submitBtn.textContent : "";
      var honey = form.querySelector('input[name="_honey"]');
      var messageEl = document.getElementById("message");

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Отправляем…";
      }

      statusEl.className = "form__status";
      statusEl.textContent = "Отправляем…";

      var done = function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = origText;
        }
      };

      if (!cfg.endpoint) {
        statusEl.className = "form__status is-error";
        statusEl.textContent = "Отправка не настроена. Напишите нам на " + (cfg.email || "info@tdvostok.pro") + ".";
        done();
        return;
      }

      fetch(cfg.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          name: fields.name.value.trim(),
          phone: fields.phone.value.trim(),
          email: fields.email.value.trim(),
          message: messageEl ? messageEl.value.trim() : "",
          _subject: "Заявка с сайта — Фумарола",
          _template: "table",
          _captcha: "false",
          _honey: honey ? honey.value : ""
        })
      }).then(function (resp) {
        return resp.json().catch(function () { return {}; });
      }).then(function (data) {
        if (data && (data.success === true || data.success === "true")) {
          form.reset();
          statusEl.className = "form__status is-success";
          statusEl.textContent = "Спасибо! Заявка отправлена — мы свяжемся с вами.";
        } else if (data && /activat/i.test(data.message || "")) {
          statusEl.className = "form__status is-error";
          statusEl.textContent = "Форма ещё не активирована: подтвердите адрес в письме от FormSubmit.";
        } else {
          throw new Error("not success");
        }
      }).catch(function () {
        statusEl.className = "form__status is-error";
        statusEl.textContent = "Не удалось отправить. Напишите нам на " + (cfg.email || "info@tdvostok.pro") + ".";
      }).then(done);
    });
  }

  /* ===== Форма запроса для тендера ===== */
  var tenderForm = document.getElementById("tenderForm");
  if (tenderForm) {
    var tenderFields = {
      org: document.getElementById("tenOrg"),
      person: document.getElementById("tenPerson"),
      phone: document.getElementById("tenPhone"),
      email: document.getElementById("tenEmail"),
      scope: document.getElementById("tenScope"),
      consent: document.getElementById("tenConsent")
    };

    function tenSetError(input, message) {
      if (!input) return;
      var wrap = input.closest(".form__field");
      var el = document.getElementById(input.id + "Error");
      if (message) {
        if (wrap) wrap.classList.add("is-invalid");
        if (el) el.textContent = message;
        input.setAttribute("aria-invalid", "true");
      } else {
        if (wrap) wrap.classList.remove("is-invalid");
        if (el) el.textContent = "";
        input.removeAttribute("aria-invalid");
      }
    }

    Object.keys(tenderFields).forEach(function (key) {
      var input = tenderFields[key];
      if (!input) return;
      input.addEventListener(key === "consent" ? "change" : "input", function () { tenSetError(input, ""); });
    });

    tenderForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var status = document.getElementById("tenStatus");
      var ok = true;
      var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!tenderFields.org.value.trim()) { tenSetError(tenderFields.org, "Укажите организацию."); ok = false; } else tenSetError(tenderFields.org, "");
      if (!tenderFields.person.value.trim()) { tenSetError(tenderFields.person, "Укажите контактное лицо."); ok = false; } else tenSetError(tenderFields.person, "");
      if (!tenderFields.phone.value.trim()) { tenSetError(tenderFields.phone, "Укажите телефон."); ok = false; } else tenSetError(tenderFields.phone, "");
      var em = tenderFields.email.value.trim();
      if (!em) { tenSetError(tenderFields.email, "Укажите e-mail."); ok = false; }
      else if (!emailPattern.test(em)) { tenSetError(tenderFields.email, "Проверьте формат e-mail."); ok = false; }
      else tenSetError(tenderFields.email, "");
      if (!tenderFields.scope.value.trim()) { tenSetError(tenderFields.scope, "Опишите, что требуется."); ok = false; } else tenSetError(tenderFields.scope, "");
      if (!tenderFields.consent.checked) { tenSetError(tenderFields.consent, "Необходимо согласие на обработку данных."); ok = false; } else tenSetError(tenderFields.consent, "");

      if (!ok) {
        status.className = "form__status is-error";
        status.textContent = "Проверьте выделенные поля.";
        return;
      }

      var cfg = window.FUMAROLA_REQUEST || {};
      var honey = tenderForm.querySelector('input[name="_honey"]');
      var btn = tenderForm.querySelector('button[type="submit"]');
      var orig = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = "Отправляем…"; }
      status.className = "form__status";
      status.textContent = "Отправляем…";

      var done = function () { if (btn) { btn.disabled = false; btn.textContent = orig; } };

      if (!cfg.endpoint) {
        status.className = "form__status is-error";
        status.textContent = "Отправка не настроена. Напишите на " + (cfg.email || "info@tdvostok.pro") + ".";
        done();
        return;
      }

      function fieldVal(id) { var el = document.getElementById(id); return el ? el.value : ""; }

      fetch(cfg.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          "Организация": tenderFields.org.value.trim(),
          "ИНН": fieldVal("tenInn"),
          "Контактное лицо": tenderFields.person.value.trim(),
          "Телефон": tenderFields.phone.value.trim(),
          "E-mail": tenderFields.email.value.trim(),
          "Закупка": fieldVal("tenTender"),
          "Ссылка": fieldVal("tenLink"),
          "Срок подачи": fieldVal("tenDeadline"),
          "Что требуется": tenderFields.scope.value.trim(),
          "Комментарий": fieldVal("tenComment"),
          _subject: "Запрос для участия в тендере — Фумарола",
          _template: "table",
          _captcha: "false",
          _honey: honey ? honey.value : ""
        })
      }).then(function (resp) {
        return resp.json().catch(function () { return {}; });
      }).then(function (data) {
        if (data && (data.success === true || data.success === "true")) {
          tenderForm.reset();
          status.className = "form__status is-success";
          status.textContent = "Спасибо! Запрос отправлен — подготовим ТКП и свяжемся с вами.";
        } else if (data && /activat/i.test(data.message || "")) {
          status.className = "form__status is-error";
          status.textContent = "Форма ещё не активирована: подтвердите адрес в письме от FormSubmit.";
        } else {
          throw new Error("not success");
        }
      }).catch(function () {
        status.className = "form__status is-error";
        status.textContent = "Не удалось отправить. Напишите нам на " + (cfg.email || "info@tdvostok.pro") + ".";
      }).then(done);
    });
  }

  /* ===== Кнопка «Наверх» в подвале ===== */
  var up = document.querySelector(".footer__up");
  if (up) {
    up.addEventListener("click", function (event) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ===== Видео: подгрузка плеера по клику ===== */
  var videoCards = document.querySelectorAll(".video-card");
  if (videoCards.length) {
    Array.prototype.forEach.call(videoCards, function (card) {
      card.addEventListener("click", function () {
        if (card.getAttribute("data-loaded")) return;

        var type = card.getAttribute("data-video-type");
        var id = card.getAttribute("data-video-id");
        var url = type === "youtube"
          ? "https://www.youtube.com/embed/" + id
          : "https://rutube.ru/play/embed/" + id + "/";

        var frame = document.createElement("iframe");
        frame.src = url;
        frame.className = "video-card__frame";
        frame.setAttribute("allow", "clipboard-write; autoplay; fullscreen");
        frame.setAttribute("allowfullscreen", "");
        frame.setAttribute("loading", "lazy");
        frame.setAttribute("title", "Видео «Фумарола»");

        card.setAttribute("data-loaded", "1");
        card.innerHTML = "";
        card.appendChild(frame);
      });
    });
  }

})();
