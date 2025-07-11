import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
  try {
    const data = url.searchParams.get('data');
    if (!data) {
      return {
        templateData: {
          instruction: "Turn off tap when not in use",
          topLeft: "R.F.S. Concentrate",
          topRight: "R.F.S. Concentrate",
          bottomLeft: "R.F.S. Concentrate",
          bottomRight: "R.F.S. Concentrate"
        }
      };
    }

    const templateData = JSON.parse(decodeURIComponent(data));
    return {
      templateData
    };
  } catch (error) {
    console.error('Error parsing template data:', error);
    return {
      templateData: {
        instruction: "Turn off tap when not in use",
        topLeft: "Top Left",
        topRight: "Top Right",
        bottomLeft: "Bottom Left",
        bottomRight: "Bottom Right"
      }
    };
  }
}; 