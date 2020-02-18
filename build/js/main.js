"use strict";

var sectionsButton = document.querySelector(".page-footer__sections").querySelector(".page-footer__button");
var adresButton = document.querySelector(".page-footer__adres").querySelector(".page-footer__button");
var adres = document.querySelector(".page-footer__adres").querySelector("ul");
var sections = document.querySelector(".page-footer__sections").querySelector("ul");
var accordionSection = sectionsButton.querySelector(".accordion");
var accordionAdres = adresButton.querySelector(".accordion");
var tabletWidth = 768;
var scrollDown = document.querySelector(".promo__scroll-down");
var scrolСonsultation = document.querySelector(".promo__button");
var feedbackBlock = document.querySelector("#feedback");
var advantagesBlock = document.querySelector("#advantages");
var callBackButton = document.querySelector(".page-header__contacts-call");
var callPopap = document.querySelector(".call-popap");
var popapCloseButton = callPopap.querySelector(".call-popap__close-button");
var popapOverlay = callPopap.querySelector(".call-popap__overlay");
var popapSubmitButton = callPopap.querySelector("button[type=submit]");
var popapInputName = callPopap.querySelector("input[name=name]");
var popapInputTel = callPopap.querySelector("input[name=tel]");
var popapInputQuest = callPopap.querySelector("textarea");

var localStorageCheck = function localStorageCheck() {
  if (localStorage.getItem('name') !== null) {
    popapInputName.value = localStorage.getItem('name');
  }

  if (localStorage.getItem('tel') !== null) {
    popapInputTel.value = localStorage.getItem('tel');
  }

  if (localStorage.getItem('quest') !== null) {
    popapInputQuest.value = localStorage.getItem('quest');
  }
};

var KEYS = {
  ESC: 27,
  ENTER: 13
};

var accordion = function accordion(target) {
  if (target == sectionsButton) {
    sections.classList.toggle("page-footer__list--hidden");
    sectionsButton.classList.toggle("page-footer__button--close");
    sectionsButton.classList.toggle("page-footer__button--open");
  } else if (target == adresButton) {
    adres.classList.toggle("page-footer__list--hidden");
    adresButton.classList.toggle("page-footer__button--close");
    adresButton.classList.toggle("page-footer__button--open");
  }
};

var accordionListener = function accordionListener(arr) {
  arr.forEach(function (title) {
    title.addEventListener("click", function () {
      accordion(title);
    });
  });
};

accordionListener([sectionsButton, adresButton]);

if (scrolСonsultation) {
  scrolСonsultation.addEventListener("keydown", function (evt) {
    if (evt.keyCode === KEYS.ENTER) {
      evt.preventDefault();
      feedbackBlock.scrollIntoView({
        behavior: "smooth"
      });
    }
  });
  scrolСonsultation.addEventListener("click", function (evt) {
    evt.preventDefault();
    feedbackBlock.scrollIntoView({
      behavior: "smooth"
    });
  });
}

if (scrollDown) {
  scrollDown.addEventListener("keydown", function (evt) {
    if (evt.keyCode === KEYS.ENTER) {
      evt.preventDefault();
      advantagesBlock.scrollIntoView({
        behavior: "smooth"
      });
    }
  });
  scrollDown.addEventListener("click", function (evt) {
    evt.preventDefault();
    advantagesBlock.scrollIntoView({
      behavior: "smooth"
    });
  });
}

var popapClose = function popapClose() {
  callPopap.classList.remove("call-popap__open");
};

var onEscPress = function onEscPress(evt) {
  if (evt.keyCode === KEYS.ESC) {
    evt.preventDefault();
    popapClose();
  }
};

var inputFocusCheck = function inputFocusCheck() {
  [popapInputName, popapInputTel, popapInputQuest].forEach(function (input) {
    input.addEventListener("focusin", function () {
      document.removeEventListener("keydown", onEscPress);
    });
    input.addEventListener("focusout", function () {
      document.addEventListener("keydown", onEscPress);
    });
  });
};

var popapOpen = function popapOpen(evt) {
  inputFocusCheck();
  localStorageCheck();
  evt.preventDefault();
  callPopap.classList.add("call-popap__open");
  document.addEventListener("keydown", onEscPress);
  document.addEventListener("click", function (evt) {
    if (evt.target === popapOverlay) {
      popapClose();
    }
  });
};

if (popapSubmitButton) {
  popapSubmitButton.addEventListener("click", function () {
    if (popapInputName.value) {
      localStorage.setItem('name', popapInputName.value);
    }

    if (popapInputTel.value) {
      localStorage.setItem('tel', popapInputTel.value);
    }

    if (popapInputQuest.value) {
      localStorage.setItem('quest', popapInputQuest.value);
    }
  });
}

if (callBackButton) {
  callBackButton.addEventListener("click", popapOpen);
}

if (popapCloseButton) {
  popapCloseButton.addEventListener("click", popapClose);
}

window.onresize = function (evt) {
  if (evt.target.innerWidth > tabletWidth) {
    adres.classList.remove("page-footer__list--hidden");
    sections.classList.remove("page-footer__list--hidden");
  }
};