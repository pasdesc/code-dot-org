import React from 'react';
import Congrats from './Congrats';

export default storybook => {
  return storybook
    .storiesOf('Congrats', module)
    .addStoryTable([
      {
        name: 'Congrats - Applab',
        description: `Congrats component if Applab tutorial completed`,
        story: () => (
          <Congrats
            completedTutorialType="applab"
            isRtl={false}
          />
        )
      },
      {
        name: 'Congrats - pre-2017 Minecraft',
        description: `Congrats component if either pre-2017 Minecraft tutorial completed`,
        story: () => (
          <Congrats
            completedTutorialType="pre2017Minecraft"
            isRtl={false}
          />
        )
      },
      {
        name: 'Congrats - 2017 Minecraft',
        description: `Congrats component if 2017 Minecraft tutorial completed`,
        story: () => (
          <Congrats
            completedTutorialType="2017Minecraft"
            isRtl={false}
          />
        )
      },
      {
        name: 'Congrats - other',
        description: `Congrats component if any other Code.org tutorial completed`,
        story: () => (
          <Congrats
            completedTutorialType="other"
            isRtl={false}
          />
        )
      },
    ]);
};
