const sectionsButton = document.querySelector(`.page-footer__sections`)
.querySelector(`.page-footer__button`);
const adresButton = document.querySelector(`.page-footer__adres`)
.querySelector(`.page-footer__button`);
const adres = document.querySelector(`.page-footer__adres`).querySelector(`ul`);
const sections = document.querySelector(`.page-footer__sections`).querySelector(`ul`);
const accordionSection = sectionsButton.querySelector(`.accordion`);
const accordionAdres = adresButton.querySelector(`.accordion`);
const tabletWidth = 768;

const accordion = (target) => {
  if (target == sectionsButton) {
      sections.classList.toggle(`hidden`);
      sectionsButton.classList.toggle(`page-footer__button--close`);
      sectionsButton.classList.toggle(`page-footer__button--open`);
  } else if (target == adresButton) {
      adres.classList.toggle(`hidden`);
      adresButton.classList.toggle(`page-footer__button--close`);
      adresButton.classList.toggle(`page-footer__button--open`);
  }
};

const accordionListener = (arr) => {
  arr.forEach(title => {
    title.addEventListener(`click`, () => {
      accordion(title);
    });
  });
}

accordionListener([sectionsButton, adresButton]);


window.onresize = (evt) => {
  if (evt.target.innerWidth > tabletWidth) {
    adres.classList.remove(`hidden`);
    sections.classList.remove(`hidden`);
  }
};



