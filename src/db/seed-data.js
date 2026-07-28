/**
 * The 30-issue seed catalog from the design handoff, for layout realism.
 * Figures are illustrative — verify any value before it ships as fact.
 */
export const SEED = [
  ['Action Comics', '1', 'DC Comics', 1938, 'Superhero', 3.0, 3200000, 'First appearance of Superman', 'Siegel & Shuster'],
  ['Detective Comics', '27', 'DC Comics', 1939, 'Crime', 4.5, 2100000, 'First appearance of Batman', 'Kane & Finger'],
  ['Marvel Comics', '1', 'Timely', 1939, 'Superhero', 5.5, 480000, 'First Human Torch and Sub-Mariner', 'Everett & Burgos'],
  ['Captain America Comics', '1', 'Timely', 1941, 'War', 6.0, 915000, 'First appearance of Captain America', 'Simon & Kirby'],
  ['Wonder Woman', '1', 'DC Comics', 1942, 'Superhero', 5.0, 96000, 'First solo Wonder Woman title', 'Marston & Peter'],
  ['All Star Comics', '8', 'DC Comics', 1941, 'Superhero', 4.0, 410000, 'First appearance of Wonder Woman', 'Marston & Peter'],
  ['Showcase', '4', 'DC Comics', 1956, 'Sci-Fi', 7.0, 285000, 'First Silver Age Flash', 'Kanigher & Infantino'],
  ['Fantastic Four', '1', 'Marvel', 1961, 'Superhero', 5.5, 520000, 'First Fantastic Four', 'Lee & Kirby'],
  ['Amazing Fantasy', '15', 'Marvel', 1962, 'Superhero', 6.5, 1100000, 'First appearance of Spider-Man', 'Lee & Ditko'],
  ['The Incredible Hulk', '1', 'Marvel', 1962, 'Superhero', 4.0, 240000, 'First appearance of the Hulk', 'Lee & Kirby'],
  ['Tales of Suspense', '39', 'Marvel', 1963, 'Sci-Fi', 5.0, 170000, 'First appearance of Iron Man', 'Lee & Heck'],
  ['The X-Men', '1', 'Marvel', 1963, 'Superhero', 6.0, 195000, 'First appearance of the X-Men', 'Lee & Kirby'],
  ['The Avengers', '4', 'Marvel', 1964, 'Superhero', 7.5, 62000, 'Captain America returns', 'Lee & Kirby'],
  ['Green Lantern', '76', 'DC Comics', 1971, 'Social', 8.0, 4200, '', 'O’Neil & Adams'],
  ['The Amazing Spider-Man', '129', 'Marvel', 1974, 'Crime', 8.5, 9800, 'First appearance of the Punisher', 'Conway & Andru'],
  ['Giant-Size X-Men', '1', 'Marvel', 1975, 'Superhero', 8.0, 15500, 'First Storm, Colossus and Nightcrawler', 'Wein & Cockrum'],
  ['Star Wars', '1', 'Marvel', 1977, 'Sci-Fi', 9.2, 1450, '', 'Thomas & Chaykin'],
  ['Cerebus', '1', 'Aardvark-Vanaheim', 1977, 'Indie', 8.5, 3400, 'First appearance of Cerebus', 'Dave Sim'],
  ['Teenage Mutant Ninja Turtles', '1', 'Mirage', 1984, 'Indie', 9.0, 42000, 'First appearance of the Turtles', 'Eastman & Laird'],
  ['Swamp Thing', '37', 'DC Comics', 1985, 'Horror', 9.4, 320, 'First appearance of John Constantine', 'Moore & Bissette'],
  ['Watchmen', '1', 'DC Comics', 1986, 'Superhero', 9.6, 210, '', 'Moore & Gibbons'],
  ['The Sandman', '1', 'Vertigo', 1989, 'Fantasy', 9.4, 480, 'First appearance of Morpheus', 'Gaiman & Kieth'],
  ['Spawn', '1', 'Image', 1992, 'Horror', 9.8, 160, 'First appearance of Spawn', 'Todd McFarlane'],
  ['Preacher', '1', 'Vertigo', 1995, 'Crime', 9.6, 140, '', 'Ennis & Dillon'],
  ['Y: The Last Man', '1', 'Vertigo', 2002, 'Sci-Fi', 9.8, 95, '', 'Vaughan & Guerra'],
  ['The Walking Dead', '1', 'Image', 2003, 'Horror', 9.8, 3800, 'First appearance of Rick Grimes', 'Kirkman & Moore'],
  ['Saga', '1', 'Image', 2012, 'Fantasy', 9.8, 320, 'First Alana and Marko', 'Vaughan & Staples'],
  ['Monstress', '1', 'Image', 2015, 'Fantasy', 9.9, 60, '', 'Liu & Takeda'],
  ['Bitter Root', '1', 'Image', 2018, 'Horror', 9.8, 45, '', 'Walker, Brown & Greene'],
  ['Nubia and the Amazons', '1', 'DC Comics', 2021, 'Fantasy', 9.8, 30, '', 'Williams, Lawrence & Ibáñez'],
];

/** Expand the compact seed rows into full records (ids c0…c29, added = row index). */
export function seedRecords() {
  return SEED.map((r, i) => ({
    id: 'c' + i,
    series: r[0],
    issue: r[1],
    publisher: r[2],
    year: r[3],
    genre: r[4],
    grade: r[5],
    price: r[6],
    keyNote: r[7],
    creators: r[8],
    image: '',
    added: i,
  }));
}
