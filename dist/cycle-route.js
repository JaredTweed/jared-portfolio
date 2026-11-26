export const cycleSegments = [
  {start:0, end:.15, name:'Shared lane', pattern:'Dotted', dash:[1,5], offset:0,
    description:'Bike markings encourage riders and drivers to share the same travel lane.'},
  {start:.15, end:.52, name:'Painted bike lane', pattern:'Dashed', dash:[8,5], offset:.493,
    description:'A painted line gives cyclists dedicated space alongside traffic.'},
  {start:.52, end:1, name:'Separated cycle track', pattern:'Solid', dash:[], offset:.493,
    description:'A raised curb physically separates the track from motor traffic.'}
];
export const segmentAt = progress => cycleSegments.find(segment => progress < segment.end) ?? cycleSegments.at(-1);
