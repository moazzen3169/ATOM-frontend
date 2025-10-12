# TODO List for Admin Verification Page Enhancement

## Task: Distinguish Approved/Rejected Requests from Pending Ones

### Goals
- Visually differentiate processed (approved/rejected) verification requests from pending ones
- Ensure pending requests are prioritized in the list
- Improve user experience for admins reviewing requests

### Steps
1. **Modify Sorting Logic in JS**
   - Update `applyFilters` function to sort by status first (pending first), then by date
   - Ensure pending requests appear at the top of the list

2. **Add Visual Distinction Classes**
   - Add 'verification-card--processed' class to approved/rejected cards in `createVerificationCard` function
   - Apply reduced opacity and subtle styling to processed cards

3. **Update CSS Styles**
   - Add styles for `.verification-card--processed` to make processed cards less prominent
   - Ensure the distinction is clear but not obstructive

4. **Test the Changes**
   - Verify sorting works correctly
   - Check visual distinction on different screen sizes
   - Ensure filters still function properly

### Files to Edit
- `js/admin/admin-verification.js`: Sorting logic and class addition
- `css/admin-verification.css`: New styles for processed cards

### Status
- [x] Plan approved
- [x] Sorting logic updated
- [x] Visual classes added
- [x] CSS styles applied
- [ ] Testing completed
