"use strict";

var sectionsButton = document.querySelector(".page-footer__sections").querySelector(".page-footer__button");
var adresButton = document.querySelector(".page-footer__adres").querySelector(".page-footer__button");
var adres = document.querySelector(".page-footer__adres").querySelector("ul");
var sections = document.querySelector(".page-footer__sections").querySelector("ul");
var accordionSection = sectionsButton.querySelector(".accordion");
var accordionAdres = adresButton.querySelector(".accordion");
var tabletWidth = 768;

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

window.onresize = function (evt) {
  if (evt.target.innerWidth > tabletWidth) {
    adres.classList.remove("hidden");
    sections.classList.remove("hidden");
  }
};