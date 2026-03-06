export const solarPerthSeeds = {
  government: [
    'https://www.cleanenergycouncil.org.au/consumers/find-an-installer',
    'https://www.energy.gov.au/rebates/small-scale-technology-certificates',
    'https://www.synergy.net.au/Your-home/Manage-account/Solar-connections',
  ],
  installers: [
    'https://www.regenpower.com',
    'https://www.infiniteenergy.com.au',
    'https://www.solarcity.com.au',
    'https://www.solarwholesale.com.au',
    'https://www.sparksolarpanels.com.au',
    'https://www.solarright.com.au',
    'https://www.positronic.com.au',
    'https://www.arise.solar',
    'https://www.solargain.com.au',
    'https://www.cleannrg.com.au',
  ],
  reviews: [
    'https://www.solarquotes.com.au/installers/perth/',
    'https://www.productreview.com.au/listings/solar-panel-installation',
  ],
  knowledge: [
    'https://en.wikipedia.org/wiki/Solar_power_in_Australia',
    'https://www.energymatters.com.au/residential-solar/',
  ],
};

export function getAllSeedUrls(): string[] {
  return [
    ...solarPerthSeeds.government,
    ...solarPerthSeeds.installers,
    ...solarPerthSeeds.reviews,
    ...solarPerthSeeds.knowledge,
  ];
}
