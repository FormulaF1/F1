// =========================================================
// 1. DATA CONFIGURATION (ข้อมูลทีม นักแข่ง และกติกาคะแนน)
// =========================================================

const TEAM_LOGOS = { 
  "Ferrari": "https://lh3.googleusercontent.com/d/1vSyLK4voiZIq9-ctG7X5aAkdPezha1xu", 
  "Red Bull Racing": "https://lh3.googleusercontent.com/d/1pM-9Vo3HyaA-ZL5bjavA0D9nNYoClRAv", 
  "McLaren": "https://lh3.googleusercontent.com/d/1EhsPjx5G3tVpXROG9x5Eos7xYXTIUKMf", 
  "Mercedes": "https://lh3.googleusercontent.com/d/1i-5H1bNHXpX3Jt7ZciAP3gmV5QjtAwlF", 
  "Aston Martin": "https://lh3.googleusercontent.com/d/1smqEEy8i7d1AbQmqVXR68hD1qP0Qwx1p", 
  "Alpine": "https://lh3.googleusercontent.com/d/1CAPj3vwXe7cWOuxBPhOX-ciiJ8FlGqFG", 
  "Williams": "https://lh3.googleusercontent.com/d/18mn901TW_w5SW4Fg5Ke0WBKgxyt-5ICN", 
  "VCARB": "https://lh3.googleusercontent.com/d/1AfEAprJx9b4ivULrg41CCYiVUnBi6ps2", 
  "Audi": "https://lh3.googleusercontent.com/d/1w0dvPdMVK2b09liK6G-XEt2LXu6S-Mt0", 
  "Sauber": "https://lh3.googleusercontent.com/d/1w0dvPdMVK2b09liK6G-XEt2LXu6S-Mt0", 
  "Haas": "https://lh3.googleusercontent.com/d/1i7aUDygqHB5Qf0ySyWIUSzy0F-YW8jHz", 
  "Cadilac": "https://lh3.googleusercontent.com/d/1GIArchbZm5K7bmSNfpkGNi8bHae5G1w0",
  "Cadillac": "https://lh3.googleusercontent.com/d/1GIArchbZm5K7bmSNfpkGNi8bHae5G1w0"
};

const TEAM_COLORS = { 
  "Ferrari": "#e10600", 
  "Red Bull Racing": "#3671c6", 
  "McLaren": "#ff8000", 
  "Mercedes": "#27f4d2", 
  "Aston Martin": "#229971", 
  "Alpine": "#ff87bc", 
  "Williams": "#005aff", 
  "VCARB": "#6692ff", 
  "Audi": "#00e701", 
  "Sauber": "#00e701", 
  "Haas": "#ffffff", 
  "Cadilac": "#ffd700",
  "Cadillac": "#ffd700" 
};

const TEAM_CARS = {
  "Ferrari": "https://lh3.googleusercontent.com/d/16fGNY2kTdnXIoDRjzkXmpbZwOn27xAAR",
  "Red Bull Racing": "https://lh3.googleusercontent.com/d/1MUwr4Pi3TbBAKIYefrPpVcmfqdqfe-OW",
  "McLaren": "https://lh3.googleusercontent.com/d/1ZFP_jPxbzfRLknkRWj_GhEHRbkBK-l6g",
  "Mercedes": "https://lh3.googleusercontent.com/d/1y_4syJ21I8PbkQ5-O8VCnkKfNMO8_t0d",
  "Aston Martin": "https://lh3.googleusercontent.com/d/17A9qzj-jYzgwDwxZxsUyhj3aZZr9XHSn",
  "Alpine": "https://lh3.googleusercontent.com/d/1VB8NbkZMwYaQpXAskv98bSpaZ97zRR3b",
  "Williams": "https://lh3.googleusercontent.com/d/1CyrgK3KDX9C__EYuUwr9o5Qj-_LRnaQh",
  "VCARB": "https://lh3.googleusercontent.com/d/11EsP5GQrWqpBv68QWc3UPahhHuWydoMX",
  "Audi": "https://lh3.googleusercontent.com/d/1lqDE-G4e6rTrFXybJi2BH2NwBrWUm8X3",
  "Sauber": "https://lh3.googleusercontent.com/d/1lqDE-G4e6rTrFXybJi2BH2NwBrWUm8X3",
  "Haas": "https://lh3.googleusercontent.com/d/1dNjNrpTi-BznASYs9cRjjQmnILOdfhxK",
  "Cadilac": "https://lh3.googleusercontent.com/d/109l7yKIfGsfABg0R5sSh35yu3aq2DAwq",
  "Cadillac": "https://lh3.googleusercontent.com/d/109l7yKIfGsfABg0R5sSh35yu3aq2DAwq"
};

const DEFAULT_DRIVER_IMG = "https://cdn-icons-png.flaticon.com/512/1995/1995470.png";

const STANDINGS_TEAM_LOGOS = {
  "Ferrari": "https://lh3.googleusercontent.com/d/1vSyLK4voiZIq9-ctG7X5aAkdPezha1xu",
  "Red Bull Racing": "https://lh3.googleusercontent.com/d/1KC9EYSP6cPPF6ql5IJAsFV5o4ijtbUzb",
  "McLaren": "https://lh3.googleusercontent.com/d/1EhsPjx5G3tVpXROG9x5Eos7xYXTIUKMf",
  "Mercedes": "https://lh3.googleusercontent.com/d/1i-5H1bNHXpX3Jt7ZciAP3gmV5QjtAwlF",
  "Aston Martin": "https://lh3.googleusercontent.com/d/1RGvvMhVcr0mT9YhAxp7eazZeiLK5QxRD",
  "Alpine": "https://lh3.googleusercontent.com/d/1ZVcZBEVtLjtKeO6C8WPS40RKixY_AUtQ",
  "Williams": "https://lh3.googleusercontent.com/d/18mn901TW_w5SW4Fg5Ke0WBKgxyt-5ICN",
  "VCARB": "https://lh3.googleusercontent.com/d/1dkHpDK-mSffLW2KeYQLM2QrhT-l_sCM8",
  "Audi": "https://lh3.googleusercontent.com/d/1w0dvPdMVK2b09liK6G-XEt2LXu6S-Mt0",
  "Haas": "https://lh3.googleusercontent.com/d/1i7aUDygqHB5Qf0ySyWIUSzy0F-YW8jHz",
  "Cadillac": "https://lh3.googleusercontent.com/d/1GIArchbZm5K7bmSNfpkGNi8bHae5G1w0"
};

const DRIVER_INFO = {
  "Kimi Antonelli": { team: "Mercedes", standingsTeam: "Mercedes", color: "#27f4d2", img: "https://lh3.googleusercontent.com/d/1XueMkRyOLH6YggOKxiU__FNxc1oxOhO7", headshot: "https://lh3.googleusercontent.com/d/1JPd4IiYhF5Wf_Ul75iPhe9zPw2v8teQN", heroImg: "https://lh3.googleusercontent.com/d/1dKERjETzZSFLhakj4cmzZeD6WOgPuhwO" },
  "George Russell": { team: "Mercedes", standingsTeam: "Mercedes", color: "#27f4d2", img: "https://lh3.googleusercontent.com/d/1wineMhWS2aqA68eErrDxvikfopeorSKD", headshot: "https://lh3.googleusercontent.com/d/1cogOB1tyuiXSx7wzLIopjEDy9OGOqai-", heroImg: "https://lh3.googleusercontent.com/d/1R3IjHuehC_264CDtbzUywssGBrHKPK3G" },
  "Max Verstappen": { team: "Red Bull Racing", standingsTeam: "Red Bull Racing", color: "#3671c6", img: "https://lh3.googleusercontent.com/d/1FIH6Hjzdr9KKxf5yYYgpFJzX2GJmp5MZ", headshot: "https://lh3.googleusercontent.com/d/1XUMoxEkMqVjcgkZJ_WICLlGzx4xD-Ti_", heroImg: "https://lh3.googleusercontent.com/d/1-tsRMoe1eihITe-pXCuRHXnCAxo55zEp" },
  "Isack Hadjar": { team: "Red Bull Racing", standingsTeam: "Red Bull Racing", color: "#3671c6", img: "https://lh3.googleusercontent.com/d/1eR94vK-62qi7bDucBnuvHNicUcve06SA", headshot: "https://lh3.googleusercontent.com/d/1O8gJ_jYfKRjeksWwkk-70XaXelhucVzb", heroImg: "https://lh3.googleusercontent.com/d/11RBSUH6UEx5Fvs07dRjljcbK-pbnCMfq" },
  "Lando Norris": { team: "McLaren", standingsTeam: "McLaren", color: "#ff8000", img: "https://lh3.googleusercontent.com/d/15gZwBnLjfhkbT2jwoXq0oe53DoinzLUR", headshot: "https://lh3.googleusercontent.com/d/1V-8HQn6Pfv2-V8MOi3X1ncN3eS_sGfPX", heroImg: "https://lh3.googleusercontent.com/d/1Jbg5gZKDThWZ7TFJp-ijprvA7Kd2h-uM" },
  "Oscar Piastri": { team: "McLaren", standingsTeam: "McLaren", color: "#ff8000", img: "https://lh3.googleusercontent.com/d/1LZaV4wfjgXtaN35WgxwuzZiE2HdCfFbs", headshot: "https://lh3.googleusercontent.com/d/1WvMxJEp2wRPz2ZulvHOdQ2k7QW4Gm0Yj", heroImg: "https://lh3.googleusercontent.com/d/1GQfzuK0gZg0-UbYaO_vMzfoBjM2Bqs15" },
  "Lewis Hamilton": { team: "Ferrari", standingsTeam: "Ferrari", color: "#e10600", img: "https://lh3.googleusercontent.com/d/1lZb4XYfCoxHyZnaqkaUoUbET1z8W6pKz", headshot: "https://lh3.googleusercontent.com/d/1f9OyBz8nBeNPuaF1KLdrGlUuUybiHFNx", heroImg: "https://lh3.googleusercontent.com/d/1P0QBsx7Hg13q9R9-PmDD2qAKvQOWvi_T" },
  "Charles Leclerc": { team: "Ferrari", standingsTeam: "Ferrari", color: "#e10600", img: "https://lh3.googleusercontent.com/d/1E1xYy5TP1ei7CqBNFsU-MI0Evr3w2sK4", headshot: "https://lh3.googleusercontent.com/d/1hynvMyKMqqBkGqq96sCTj0yPx_3nAJd7", heroImg: "https://lh3.googleusercontent.com/d/1XynL1bRZfH1rUvs8Zdvh2QGoD7tnrK_b" },
  "Liam Lawson": { team: "VCARB", standingsTeam: "VCARB", color: "#6692ff", img: "https://lh3.googleusercontent.com/d/11RZ7qdc_blnLI4QmWTFOq2b-ontSKjnR", headshot: "https://lh3.googleusercontent.com/d/1exC0YVYungiAqMJ0AnCP9d1XeWkIsgXl", heroImg: "https://lh3.googleusercontent.com/d/1h1lSoOzyEFjpI4DR1ikTDzlfGS7BgXxE" },
  "Arvid Lindblad": { team: "VCARB", standingsTeam: "VCARB", color: "#6692ff", img: "https://lh3.googleusercontent.com/d/1SMM0ioYV1iuDY3IdjeILDHcyrz585RLx", headshot: "https://lh3.googleusercontent.com/d/1SNOnd7pux2M-jB4-puulcXwpZbh3vxew", heroImg: "https://lh3.googleusercontent.com/d/12lCnI-6KXN-CJpGpKPoCqvXz9xfoZD2F" },
  "Nico Hülkenberg": { team: "Audi", standingsTeam: "Sauber", color: "#00e701", img: "https://lh3.googleusercontent.com/d/1gAGhigxnQpFXRJzmomddT1pdQgxrflJO", headshot: "https://lh3.googleusercontent.com/d/1gilFs7cWCw4gZNILUPwqCnYZ-ZA1dQuJ", heroImg: "https://lh3.googleusercontent.com/d/1mQ177Wz0RU_5HsgiDlOcpy8-JxQt3six" },
  "Gabriel Bortoleto": { team: "Audi", standingsTeam: "Sauber", color: "#00e701", img: "https://lh3.googleusercontent.com/d/1rQQ2uxUgKw1YMqLFndjIAhNHvbTC31qI", headshot: "https://lh3.googleusercontent.com/d/1jlp92jslcQEXfc5XivFmjAZMY7iKC4ju", heroImg: "https://lh3.googleusercontent.com/d/1ndGFTgpIZ931uV6j78OAZsf7upT643cX" },
  "Oliver Bearman": { team: "Haas", standingsTeam: "Haas", color: "#ffffff", img: "https://lh3.googleusercontent.com/d/1y32Nd5CGiQQL9LVXW2Yyg-uBGCdE62QL", headshot: "https://lh3.googleusercontent.com/d/1dFbFnhW82fxap4gYVWsExd6xZmo-axmk", heroImg: "https://lh3.googleusercontent.com/d/1Nq5z0CMausrZ-VJHJP9XA61yUN43RbCb" },
  "Esteban Ocon": { team: "Haas", standingsTeam: "Haas", color: "#ffffff", img: "https://lh3.googleusercontent.com/d/1dIYK5u651tz4uFLXElJY7RijV4EKRBGd", headshot: "https://lh3.googleusercontent.com/d/1G0ZXdtwaFsl7YB2abkFPbtFS7YTJ2R44", heroImg: "https://lh3.googleusercontent.com/d/1LXZ6XDRHnsJEEK7aKg9Ncn1rhA_rGNl2" },
  "Carlos Sainz": { team: "Williams", standingsTeam: "Williams", color: "#005aff", img: "https://lh3.googleusercontent.com/d/1xpTy6YAwaPPA1NOHQdg3SttuEi0T1TsW", headshot: "https://lh3.googleusercontent.com/d/11OnFZVfgKQuIn-iiTOy8gn84ef8HEcP2", heroImg: "https://lh3.googleusercontent.com/d/1vEsxSNqjrYvDDgalFc3YtZRihvpTgpRG" },
  "Alexander Albon": { team: "Williams", standingsTeam: "Williams", color: "#005aff", img: "https://lh3.googleusercontent.com/d/1LnzHzqrhNAL1l3w7mVtr-iKTD4Rk06gw", headshot: "https://lh3.googleusercontent.com/d/11hihz-EOy8lWhLeYC0_1gJ8MZfRHiyHa", heroImg: "https://lh3.googleusercontent.com/d/1CC1xjveZMt54RbRJbkV0j55iocgxOu9B" },
  "Pierre Gasly": { team: "Alpine", standingsTeam: "Alpine", color: "#ff87bc", img: "https://lh3.googleusercontent.com/d/1maqM4IhIgFkmRQ_KelrWPQraNPO_qu5_", headshot: "https://lh3.googleusercontent.com/d/15agHTWnibHBmPgyoyodzfEFc4xbBFA7r", heroImg: "https://lh3.googleusercontent.com/d/1uj5_6tXWotXE-iHOyrrLNBE1MUI6chgj" },
  "Franco Colapinto": { team: "Alpine", standingsTeam: "Alpine", color: "#ff87bc", img: "https://lh3.googleusercontent.com/d/1Fnl0mVNwXZZC41s0SQU9AqAwQkD1f198", headshot: "https://lh3.googleusercontent.com/d/1HixFZqNBYmS933gXxneOInA-Be9daQ1K", heroImg: "https://lh3.googleusercontent.com/d/1dyZ48r-NWXrpqgp3ZLnLIHIMbQmx_k1b" },
  "Fernando Alonso": { team: "Aston Martin", standingsTeam: "Aston Martin", color: "#229971", img: "https://lh3.googleusercontent.com/d/1b9pCYfexGdOmo8fLfDTiH4spH5lXJrLU", headshot: "https://lh3.googleusercontent.com/d/1s551SXjYkq2g0E2OWCN5TyUGq_-PPc-L", heroImg: "https://lh3.googleusercontent.com/d/156c1C-IqkFp5Szx5l91BbqYVFcQJRbo-" },
  "Lance Stroll": { team: "Aston Martin", standingsTeam: "Aston Martin", color: "#229971", img: "https://lh3.googleusercontent.com/d/1VCHnoTG4I8LiJL6AxBMnsXGJU4jpLbAi", headshot: "https://lh3.googleusercontent.com/d/1cIob029sx-tSOm9IGLFWwzc0sqzHxOrB", heroImg: "https://lh3.googleusercontent.com/d/1Yvth9xx_ssAZFdPJR_mZO6oMK649GxGi" },
  "Sergio Pérez": { team: "Cadillac", standingsTeam: "Cadillac", color: "#ffd700", img: "https://lh3.googleusercontent.com/d/1DAVP6b75_8Y0v4LEfCKnXlNxnKhOgHBh", headshot: "https://lh3.googleusercontent.com/d/1U14btMCB4fF9UamzLjbGUHmFCfs-3jSp", heroImg: "https://lh3.googleusercontent.com/d/1ontnpE4NHtSNGRuDpWIcQTLcAVdT8ZZK" },
  "Valtteri Bottas": { team: "Cadillac", standingsTeam: "Cadillac", color: "#ffd700", img: "https://lh3.googleusercontent.com/d/1j_esvm_OfYqmfPB4lsKvbfPZUMO3FvCq", headshot: "https://lh3.googleusercontent.com/d/106vLZiJ1hTJ1bc8wWOqTAYVB4D4RT7jk", heroImg: "https://lh3.googleusercontent.com/d/1HgGyl9w7xR-z9YU4NnmEqh9k1vqnxPDO" }
};

const DRIVERS = Object.keys(DRIVER_INFO);

const SCORING_RULES = {
  EXACT_POS: 2,        
  FASTEST_LAP: 1,      
  IN_TOP4_WRONG_POS: 0 
};
