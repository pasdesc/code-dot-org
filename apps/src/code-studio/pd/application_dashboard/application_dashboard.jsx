/**
 * Main landing page and router for the application dashboard.
 */
import React from 'react';
import Header from '../components/header';
import {
  Router,
  Route,
  IndexRedirect,
  useRouterHistory
} from 'react-router';
import {createHistory} from 'history';
import Summary from './summary';
import QuickView from './quick_view';
import DetailView from './detail_view';
import _ from 'lodash';

const ROOT_PATH = '/pd/application_dashboard';
const browserHistory = useRouterHistory(createHistory)({
  basename: ROOT_PATH
});

const ApplicationDashboardHeader = (props) => (
  <Header
    baseName="Application Dashboard"
    {...props}
  />
);

const paths = {
  'csf_facilitators': 'CS Fundamentals Facilitator Applications',
  'csd_facilitators': 'CS Discoveries Facilitator Applications',
  'csp_facilitators': 'CS Principles Facilitator Applications',
  'csd_teachers': 'CS Discoveries Teacher Applications',
  'csp_teachers': 'CS Principles Teacher Applications'
};

const ApplicationDashboard = ()=> (
  <Router history={browserHistory} >
    <Route path="/" component={ApplicationDashboardHeader}>
      <IndexRedirect to="/summary"/>
      <Route
        path="summary"
        breadcrumbs="Summary"
        component={Summary}
      />
      {
        _.flatten(Object.keys(paths).map((path, i) => {
          return [
            (
              <Route
                key={`detail_${i}`}
                path={`${path}/(:applicationId)`}
                breadcrumbs={[
                  {name: paths[path], path: path},
                  {name: 'Application Details', path: ''}
                ]}
                component={DetailView}
                title={'Application Detail'}
              />
            ),
            (
              <Route
                key={`quick_view_${i}`}
                path={path}
                breadcrumbs={paths[path]}
                component={QuickView}
                title={paths[path]}
              />
            )
          ];
        }))
      }
    </Route>
  </Router>
);

export default ApplicationDashboard;
