const promoButton = document.querySelector(`.promo__button`);
const TABLET_WIDTH = 768;


window.onresize = (evt) => {
  if (evt.target.innerWidth < TABLET_WIDTH) {
    promoButton.textContent = `БЕСПЛАТНАЯ КОНСУЛЬТАЦИЯ`;
  } else {
    promoButton.textContent = `ПОЛУЧИТЬ БЕСПЛАТНУЮ КОНСУЛЬТАЦИЮ`;
  }
}
