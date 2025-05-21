document.addEventListener("DOMContentLoaded", function () {
  new Swiper('.mySwiper', {
    loop: true,
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev'
    },
    grabCursor: true,
    spaceBetween: 24,
    observeParents: true,
    observer: true,
    breakpoints: {
      0: { slidesPerView: 1 },
      600: { slidesPerView: 1.2 },
      768: { slidesPerView: 2 },
      992: { slidesPerView: 3 }
    }
  });
});
