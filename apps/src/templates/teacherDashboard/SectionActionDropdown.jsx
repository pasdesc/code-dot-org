import React, {Component, PropTypes} from 'react';
import {sortableSectionShape} from "./shapes.jsx";
import QuickAction from "../tables/QuickAction";
import QuickActionsCell from "../tables/QuickActionsCell";
import PrintCertificates from "./PrintCertificates";
import i18n from '@cdo/locale';

export default class SectionActionDropdown extends Component {
  static propTypes = {
    handleEdit: PropTypes.func,
    sectionData: sortableSectionShape.isRequired,
  };

  state = {
    selected: false,
    names: [],
  };

  onClickEdit = () => {
    this.props.handleEdit(this.props.sectionData.id);
  };

  render() {
    const {sectionData} = this.props;
    return (
      <QuickActionsCell>
        <QuickAction
          text={i18n.editSectionDetails()}
          action={this.onClickEdit}
          hasLineAbove={true}
        />
        <PrintCertificates
          sectionId={sectionData.id}
          assignmentName={sectionData.assignmentNames[0]}
          onClick={() => console.log("Bleepty Bloop")}
        />
      </QuickActionsCell>
    );
  }
}
