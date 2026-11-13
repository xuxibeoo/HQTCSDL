const art = "/cinema-art/";
const seedPosters = ["poster-01.jpg", "poster-02.jpg", "poster-03.jpg", "poster-04.jpg", "poster-01.jpg"];

export function moviePoster(movie) {
  const seedPoster = seedPosters[movie.ma_phim - 1];
  if (seedPoster && movie.anh === "/poster/" + movie.ma_phim + ".svg") return art + seedPoster;
  return movie.anh || "/poster/" + movie.ma_phim + ".svg";
}

export function movieBackdrop(movie) {
  return movie.ma_phim === 1 && movie.anh === "/poster/1.svg" ? art + "premiere.jpg" : moviePoster(movie);
}
