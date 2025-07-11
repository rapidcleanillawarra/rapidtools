import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
  const defaultTemplateData = {
    topLeft: {
      title: "R.F.S. Concentrate",
      code: "K11",
      logo: "/images/bottle.svg",
      description: "Hard Surface Cleaner"
    },
    topRight: {
      title: "Floor Cleaner Pro",
      code: "K12",
      logo: "/images/scrubber.svg",
      description: "Floor Cleaner"
    },
    bottomLeft: {
      title: "Crystal Clean",
      code: "K14",
      logo: "/images/sink_fill.svg",
      description: "Glass Cleaner"
    },
    bottomRight: {
      title: "Multi-Clean Plus",
      code: "K13",
      logo: "/images/bucket.svg",
      description: "Multi-Purpose Cleaner"
    },
    instruction: "Mix with water according to label instructions"
  };

  try {
    const data = url.searchParams.get('data');
    if (!data) {
      return {
        templateData: defaultTemplateData
      };
    }

    const templateData = JSON.parse(decodeURIComponent(data));
    return {
      templateData
    };
  } catch (error) {
    console.error('Error parsing template data:', error);
    return {
      templateData: defaultTemplateData
    };
  }
}; 