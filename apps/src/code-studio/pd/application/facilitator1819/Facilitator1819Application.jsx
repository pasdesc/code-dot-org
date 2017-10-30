import {PropTypes} from 'react';

import FormController from '../../form_components/FormController';
import Section1AboutYou from './Section1AboutYou';
import Section2ChooseYourProgram from './Section2ChooseYourProgram';
import Section3LeadingStudents from './Section3LeadingStudents';
import Section4FacilitationExperience from './Section4FacilitationExperience';
import Section5YourApproachToLearningAndLeading from './Section5YourApproachToLearningAndLeading';
import Section6Logistics from './Section6Logistics';
import Section7Submission from './Section7Submission';

// This is just for testing & bug bashing, but should not be merged
// TODO: remove this before merging
import reactTriggerChange from 'react-trigger-change';


export default class Facilitator1819Application extends FormController {
  static propTypes = {
    ...FormController.propTypes,
    accountEmail: PropTypes.string.isRequired
  };

  static submitButtonText = "Complete and Send";

  // This is just for testing & bug bashing, but should not be merged
  // TODO: remove this before merging
  componentDidMount() {
    const randomText = (length = 10) => Math.random().toString(36).substr(2, length);
    const randomNumberString = (length) => Math.random().toString().substr(2, length);
    const randomInt = (min, max) => Math.round(Math.random() * (max - min) + min);
    const generateText = (label) => {
      switch (label) {
        case 'phone':
          return `(${randomNumberString(3)}) ${randomNumberString(3)}-${randomNumberString(4)}`;
        case 'zipCode':
          return randomNumberString(5);
        default:
          return `${label}-${randomText()}`;
      }
    };

    const fillFormElement = element => {
      let changed;
      if (["INPUT", "TEXTAREA"].includes(element.tagName)) {
        const text = generateText(element.id);
        changed = $(element).val(text);
        console.log(`text ${element.tagName} ${element.id}: ${text}`);
      } else {
        let options = $(element).find("input[type='radio'],[type='checkbox']");
        if (options.length) {
          const selectedIndex = randomInt(0, options.length - 1);
          changed = options.eq(selectedIndex).prop("checked", true);
          console.log(`${changed.attr("type")} ${element.id}: ${selectedIndex}, ${changed.val()}`);
        } else {
          options = $(element).find("option");
          if (options.length) {
            const selectedIndex = randomInt(0, options.length - 1);
            options.eq(selectedIndex).prop("selected", true);
            changed = $(element);
            console.log(`select ${element.id}: ${selectedIndex}, ${changed.val()}`);
          } else {
            console.error(`Unable to fill ${element.id}`);
          }
        }
      }

      reactTriggerChange(changed.get(0));
    };

    window.fillForm = (andClickNext = true) => {

      let filledElements = [];
      let newElements;
      do {
        const elements = $("#application-container").find("*[id]").toArray();
        newElements = elements.filter(e => !filledElements.includes(e));
        newElements.forEach(element => fillFormElement(element));
        filledElements = filledElements.concat(newElements);
      } while (newElements.length > 0);

      if (andClickNext) {
        $("button:contains('Next')").click();
      }
    };

    window.fillEntireForm = () => {
      let i = 0;
      while ($("button:contains('Next')").length && ++i < 10) {
        window.fillForm();
      }
      // One last time for the final page
      window.fillForm();
    };

    if (window.location.search.includes("autoFill")) {
      setTimeout(() => window.fillEntireForm(), 100);
    }
  }

  /**
   * @override
   */
  getPageComponents() {
    return [
      Section1AboutYou,
      Section2ChooseYourProgram,
      Section3LeadingStudents,
      Section4FacilitationExperience,
      Section5YourApproachToLearningAndLeading,
      Section6Logistics,
      Section7Submission
    ];
  }

  /**
   * @override
   */
  getPageProps() {
    return {
      ...super.getPageProps(),
      accountEmail: this.props.accountEmail
    };
  }

  /**
   * @override
   */
  onSuccessfulSubmit() {
    // Let the server display a confirmation page as appropriate
    window.location.reload(true);
  }
}
