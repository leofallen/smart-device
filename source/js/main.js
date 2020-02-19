const sectionsButton = document.querySelector(`.page-footer__sections`)
.querySelector(`.page-footer__button`);
const adresButton = document.querySelector(`.page-footer__adres`)
.querySelector(`.page-footer__button`);
const adres = document.querySelector(`.page-footer__adres`).querySelector(`ul`);
const sections = document.querySelector(`.page-footer__sections`).querySelector(`ul`);
const scrollDown = document.querySelector(`.promo__scroll-down`);
const scrolСonsultation = document.querySelector(`.promo__button`);
const feedbackBlock = document.querySelector(`#feedback`);
const advantagesBlock = document.querySelector(`#advantages`);
const callBackButton = document.querySelector(`.page-header__contacts-call`);
const callPopap = document.querySelector(`.call-popap`);
const popapCloseButton = callPopap.querySelector(`.call-popap__close-button`);
const popapOverlay = callPopap.querySelector(`.call-popap__overlay`);
const popapSubmitButton = callPopap.querySelector(`button[type=submit]`);
const popapInputName = callPopap.querySelector(`input[name=name]`);
const popapInputTel = callPopap.querySelector(`input[name=tel]`);
const popapInputQuest = callPopap.querySelector(`textarea`);
const feedbackInputTel = document.querySelector(`.feedback__form-wrapper`)
.querySelector(`input[name=tel]`);

const TABLET_WIDTH = 768;
const KEYS = {
  ESC: 27,
  ENTER: 13
}

const localStorageCheck = () => {
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


const accordion = (target) => {
  if (target == sectionsButton) {
      sections.classList.toggle(`page-footer__list--hidden`);
      sectionsButton.classList.toggle(`page-footer__button--close`);
      sectionsButton.classList.toggle(`page-footer__button--open`);
  } else if (target == adresButton) {
      adres.classList.toggle(`page-footer__list--hidden`);
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

if (scrolСonsultation) {
  scrolСonsultation.addEventListener(`keydown`, (evt) => {
    if (evt.keyCode === KEYS.ENTER) {
      evt.preventDefault();
      feedbackBlock.scrollIntoView({
        behavior: "smooth"
    });
   }
  });


  scrolСonsultation.addEventListener(`click`, (evt) => {
    evt.preventDefault();
    feedbackBlock.scrollIntoView({
      behavior: "smooth"
    });
  });
}


if (scrollDown) {
  scrollDown.addEventListener(`keydown`, (evt) => {
    if (evt.keyCode === KEYS.ENTER) {
      evt.preventDefault();
      advantagesBlock.scrollIntoView({
        behavior: "smooth"
    });
   }
  });

  scrollDown.addEventListener(`click`, (evt) => {
    evt.preventDefault();
    advantagesBlock.scrollIntoView({
      behavior: "smooth"
    });
  });
}


const popapClose = () => {
  callPopap.classList.remove(`call-popap__open`);
  document.querySelector(`body`).classList.remove(`body-block-mixin`);
}

const onEscPress = (evt) => {
    if (evt.keyCode === KEYS.ESC) {
      evt.preventDefault();
      popapClose();
    }
};

const inputFocusCheck = () => {
  [popapInputName, popapInputTel, popapInputQuest].forEach(input => {
    input.addEventListener(`focusin`, () => {
      document.removeEventListener(`keydown`, onEscPress);
    });
    input.addEventListener(`focusout`, () => {
      document.addEventListener(`keydown`, onEscPress);
    })
  });
};

const popapOpen = (evt) => {
  document.querySelector(`body`).classList.add(`body-block-mixin`);

  inputFocusCheck();
  localStorageCheck();
  evt.preventDefault();
  callPopap.classList.add(`call-popap__open`);
  document.addEventListener(`keydown`, onEscPress);
  document.addEventListener(`click`, (evt) => {
    if (evt.target === popapOverlay) {
      popapClose();
    }
  })
};

if (popapSubmitButton) {
  popapSubmitButton.addEventListener(`click`, () => {
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
  callBackButton.addEventListener(`click`, popapOpen);
}

if (popapCloseButton) {
  popapCloseButton.addEventListener(`click`, popapClose);
}

window.onresize = (evt) => {
  if (evt.target.innerWidth > TABLET_WIDTH) {
    adres.classList.remove(`page-footer__list--hidden`);
    sections.classList.remove(`page-footer__list--hidden`);
  }
};

if (IMask) {
  const maskOptions = {
    mask: '+{7}(000)000-00-00'
  };
  const mask1 = IMask(feedbackInputTel, maskOptions);
  const mask2 = IMask(popapInputTel, maskOptions);
}
