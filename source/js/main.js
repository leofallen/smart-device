const sectionsTitle = document.querySelector(`.footer-title-sections`);
const adresTitle = document.querySelector(`.footer-title-adres`);
const adres = document.querySelectorAll(`.footer-adres`);
const sections = document.querySelectorAll(`.footer-sections`);
const accordionSection = sectionsTitle.querySelector(`.accordion`);
const accordionAdres = adresTitle.querySelector(`.accordion`);
const tabletWidth = 768;

// window.onresize = (evt) => {
//   if (evt.target.innerWidth < tabletWidth) {
//     [sectionsTitle, adresTitle].forEach(title => {
//       title.addEventListener(`click`, () => {
//         accordion(title)
//       });
//     });
//   }
// };

const accordion = (target) => {
  if (target.classList.contains(`footer-title-sections`)) {
    for (el of sections) {
      el.classList.toggle(`hidden`)
    }
    accordionSection.classList.toggle(`accordion-close`);
  } else {
    for (el of adres) {
      el.classList.toggle(`hidden`)
    }
    accordionAdres.classList.toggle(`accordion-close`);
  }
};

[sectionsTitle, adresTitle].forEach(title => {
  title.addEventListener(`click`, () => {
    accordion(title)
  });
});


