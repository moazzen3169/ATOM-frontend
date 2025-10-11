# TODO: Fix Ticket Form in user-dashboard/tickets.html

## Information Gathered
- The form is located in `user-dashboard/tickets.html` with class `.answer_form`.
- Styles are defined in `css/user-tickets.css`.
- Current form has a semi-transparent background (`rgba(16, 18, 30, 0.85)`) when conversation is open (`.C-open .answer_form`).
- Textarea input has background color `var(--card-color)` and white text color.
- Form uses a grid layout with 5 columns, input spans 4 columns, actions in the last.
- Form already takes full width.

## Plan
- [ ] Remove background color from `.C-open .answer_form` to have no background.
- [ ] Change textarea background to transparent and ensure text color contrasts with the new background (possibly change to a darker color if needed).
- [ ] Adjust form layout to flex for better organization and neat display.
- [ ] Ensure form takes full width and is responsive.

## Dependent Files to Edit
- `css/user-tickets.css`: Modify styles for `.answer_form`, `.C-open .answer_form`, `.answer_form form`, `.answer_input textarea`.

## Followup Steps
- [ ] Test the changes by running the application and checking the ticket form display.
- [ ] Verify that input color differs from background and form is neat.
- [ ] Confirm with user if adjustments are needed.
