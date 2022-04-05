/// <reference types="cypress" />
const baseURL = 'https://www.userlane.com/careers'; // Can be set in the config file too.

describe('Use case for userlane : Career page test', () => {

	it('Check and apply for QA job', () => {

		cy.intercept('GET', '**/careers').as('getCareers');
		cy.intercept('GET', 'https://api.lever.co/v0/postings/userlane?group=team&mode=json').as('jobLever-Api');

		cy.visit(baseURL);
		cy.wait('@getCareers').its('response.statusCode').should('be.oneOf', [200, 301]);

		cy.wait('@jobLever-Api').should(({ response }) => {

			expect(response.statusCode).to.eq(200);

			// This https://api.lever.co/v0/postings/userlane?group=team&mode=json API is responsible to load all open positions in userlane career section. If this API fails, Open positions won't load/seen. 

			expect(response.statusMessage).to.eq('OK');

		});

		cy.title().should('eq', 'Career and Job openings at Userlane - www.userlane.com');

		// ---------- Wait for the button to appear in the DOM and click on the "Open positions button" ----------

		cy.get('a[href="#careers-at-userlane"][title="Open Positions"]').should('be.visible').and('have.text', 'Open Positions').click();
		cy.url().should('eq', `${baseURL}/#careers-at-userlane`);

		// ----------  Visit Career Opportunities section and sort the jobs by engineering domain ----------  

		cy.get('h4').should('be.visible').contains('Apply and join the company');
		cy.get('#jobs-container > h2').should('be.visible').and('have.text', 'Career Opportunities');

		cy.get('#jobs-container > div > a[href="#"]').contains('Engineering').should('be.visible').click();

		// Checking if the "Engineering" is clicked or not. 

		cy.get('a[href="#"]').contains('Engineering').should('have.class', 'active');

		// Remove the target=_blank attribute so that jobs page opens in the current tab.

		cy.get('a.job-title').invoke("removeAttr", "target");


		// ---------- Check if the QA Job openings ---------- : 

		/*   Logic which adopted to find the QA jobs : 
				
			Pass the common keywords which is used in QA job titles via Regular expression in ".Contains" and clicking the same if any results matches. 
		
			Test will fail if no results are found which indicates that there are no QA/Testing jobs. 
			
			If there are multiple results, i will click the first result by first() method. 
			
			Currently, i have added only two keyword i.,e Test Engineer and Quality Assurance Engineer which are most commonly used in QA job titles.
			(Case insensitive in regex). 
			
			More keyword can be added in regex for better results.
			
		*/

		cy.get('.job-item__title').contains(/Test.Engineer|Quality.Assurance.Engineer/gi).as('QA-job')
		cy.get('@QA-job').should('be.visible');

		cy.get('@QA-job').first().then(($jobTitle) => { // Save the job title for future assertions
			const jobName = $jobTitle.text();
			cy.wrap(jobName).as('job-name');
		});
		cy.get('@QA-job').first().closest('a').then(($jobLink) => { // Save the job link for future assertions
			const jobLink = $jobLink.attr('href');
			cy.wrap(jobLink).as('job-link');
			cy.intercept('GET', `${jobLink}`).as('jobLinkRequest');
		});

		// ---------- Click on the job and perform basic assertion in job description page ----------

		cy.get('@QA-job').first().click();

		cy.wait('@jobLinkRequest').its('response.statusCode').should('be.oneOf', [200, 301, 304]);

		cy.get('@job-name').then(jobName => {
			cy.get('.posting-headline > h2').should('be.visible').and('have.text', jobName);
			cy.title().should('eq', `Userlane GmbH - ${jobName}`);
		});

		cy.get('@job-link').then(jobLink => {
			cy.url().should('eq', jobLink);
			cy.intercept('GET', `${jobLink}/apply`).as('job-apply'); // After clicking on apply, user will be re-directed to $joblink/apply page.
		});

		// ---------- Click on the "Apply for this job" and perform basic assertion   ----------


		cy.get('a').contains('Apply for this job').should('be.visible');
		cy.get('a').contains('Apply for this job').first().click();
		cy.wait('@job-apply').its('response.statusCode').should('eq', 200);

		cy.get('@job-link').then(jobLink => {
			cy.url().should('eq', `${jobLink}/apply`);
		});

		cy.get('@job-name').then(jobName => {
			cy.get('.posting-header > h2').should('be.visible').and('have.text', jobName);
			cy.title().should('eq', `Userlane GmbH - ${jobName}`);
		});

		// ----------  Fill the mandatory fields in the job form ----------  

		cy.get('#resume-upload-input').selectFile('Sample-pdf-for-test.pdf'); // ---- Upload the CV.

		cy.intercept('POST', 'https://jobs.lever.co/parseResume').as('parseResume');

		cy.wait('@parseResume').should(({ response }) => {

			expect(response.statusCode).to.be.oneOf([403, 500]);  // As I uploaded CV is not in a valid format to parse to the form. 
			expect(response.statusMessage).to.be.oneOf(['Forbidden', 'Internal Server Error']);

		});

		cy.get('.filename').should('be.visible').and('have.text', 'Sample-pdf-for-test.pdf');  // Check if the file is uploaded or not. 

		cy.get('input[name="name"]').should('be.visible').type('Cypress Automation'); // ----  Entering Full name 

		cy.get('input[name="email"]').should('be.visible').type('cypress-automation@test.com'); // Entering Email

		cy.get('input[name="phone"]').should('be.visible').type('+91 1111111111'); // Entering Phone

		cy.get('input[name="cards[b6003f01-23c3-4880-bdc9-a553b23948a9][field0]"]').should('be.visible').type('3 months'); // Entering Notice period 

		cy.get('input[type="radio"][name="cards[feb7d9d3-23a6-4c29-9e9f-5d9db2a872f4][field0]"]').should('be.visible').check('Yes'); // Checking the 'Yes' for the location question

		cy.get('input[name="cards[a84c6739-175e-4233-aeee-8806fce30c87][field0]"]').should('be.visible').type('10000'); // Entering Salary expectation.

		cy.get('input[name="cards[12a521d5-15b0-4471-9f02-891fdb44fa31][field0]"]').should('be.visible').check('Yes'); // Checking the 'Yes' for work experience in cypress. 


		// ---------- Solve the hcaptcha & submit the application ---------- 


		/*  ----------  Handling iframe of hcaptcha ---------- : 
		
			I have not used iframe plugin. I grabbed the iframe contents in iframe call back and wrapped the body contents in cy.wrap so that we can use various cypress commands in later stages. 
			
			The same thing can be achieved with help of iframe plugin i.e, : 
			
			cy.iframe($iframe selector).find($checkbox).should('be.visible').click();
		
		*/

		cy.get('iframe[title="widget containing checkbox for hCaptcha security challenge"]').then($iframe => {
			const body = $iframe.contents().find('body');
			cy.wrap(body).as('hCaptcha-iframe');
		});


		/*    Bypassing hCaptcha  : 
		
			To bypass the hCaptcha, i have signed up for Accessibility user where the hcaptcha returns a cookie to set in our browser to bypass the captcha. 
			I have applied the same cookie to the browser to bypass the captcha. 
			After setting the cookie, A Simple click on the checkbox will verify, that i am not a bot. (No need to solve the puzzle).
					
		*/

		cy.get('@hCaptcha-iframe').find('#a11y-label').should('not.be.visible').and('have.text', 'hCaptcha checkbox. Select in order to trigger the challenge, or to bypass it if you have an accessibility cookie.'); // Before Clicking the Captcha

		cy.setCookie('hc_accessibility', "${Enter the value of the here}");  // Cookie can be set before starting the test.
		cy.getCookie('hc_accessibility').should('exist').and('value', "${Enter the value of the here}");

		cy.get('@hCaptcha-iframe').find('#anchor-state > #checkbox').should('be.visible').click();
		cy.get('@hCaptcha-iframe').find('#a11y-label').should('not.be.visible').and('have.text', 'hCaptcha checkbox. You are verified');

		// ---------- Submit the application  ---------- : 

		cy.get('button[data-qa="btn-submit"]').should('be.visible').and('have.text', 'Submit application');
		cy.get('@job-link').then(jobLink => {

			cy.intercept('POST', `${jobLink}/apply`).as('form-submitted');      // POST request after form is submitted.
			cy.intercept('GET', `${jobLink}/thanks`).as('job-applied-thanks');  // After submission user will land into $jonlink/thanks page. 

		});

		cy.get('button[data-qa="btn-submit"]').click();

		cy.wait('@form-submitted').should(({ response }) => {   // check for a successful response from the backend when the job form is submitted.

			expect(response.statusCode).to.eq(302);
			expect(response.statusMessage).to.eq('Found');

		});



		// ---------- Basis assertion once the application is submitted  ---------- : 

		cy.wait('@job-applied-thanks').its('response.statusCode').should('be.oneOf', [200, 301, 304]);

		cy.get('@job-link').then(jobLink => {
			cy.url().should('eq', `${jobLink}/thanks`);
		});

		cy.get('@job-name').then(jobName => {
			cy.get('h2').should('be.visible').and('have.text', jobName);
			cy.title().should('eq', `Userlane GmbH - ${jobName}`);
		});

		cy.get('[data-qa="msg-submit-success"]').should('be.visible').and('have.text', 'Application submitted!');

		cy.get('a[href="https://jobs.lever.co/userlane"]').should('be.visible').and('have.text', 'Return to the main page');

	});

});


/* --------------- Other info regarding overall automated test which is written in the above code ----------------------

	A. Regarding static selector in the careers and jobs.lever web : 
	
	There were less static selector (Like ID, Custom custom attributes like "cy-data","data-test") for QA which are applied on the elements in careers and jobs.lever page. 
	Hence i had to use "class" to grab/select the elements in many places which is not the best practice. 
	
	I prefer to use selectors as below order :
	
	Static attributes like ID or custom attributes like cy-data,data-test,data-test-id etc, Followed by
	Any unique attribute on the element, Followed by
	X Path (So that i can avoid dynamic selectors) Followed by
	Any dynamic selectors if i have no option. 

	In the above test case, I have not used X path as it requires to install x-path plugin & also to maintain the uniformity in the test file. 
	
	Also, i am not sure i am allowed to use it. 
	
	If the X-path is allowed, I would like to replaces all the "class" selectors (Basically dynamic selectors) which i have used in the above test file. 

	---------

	B. Regarding organizing the above test : 

	As this is a simple single file test, I have not organized the above test very well. 
	
	I.e, I have not adopted pageObject design pattern or I can group the selectors and the data which is passed into the form/test in fixtures. 
	
	The above test can be organized in much better way. 

	--------

	C. Regarding test file and it's dependencies : 
	
	I have pushed just the test case file to the Git hub. I am assuming, All the cypress dependencies you have it. 
	
	Also, All the comments and other info's which i felt, i have mentioned in the same file just to keep the things simple and everything can be reviewed in a single file.

		
*/