# Simple GitHub Collaboration Guide For StudyNova

This guide explains how each student can contribute to the StudyNova repository.

## Important Idea

GitHub contributors are created from commits.

For each student to appear as a contributor:

1. The student must commit with their own Git name and email.
2. The student must push their own branch.
3. Their Pull Request must be merged into `main`.

## Owner Setup

### 1. Invite Students To The Repository

On GitHub:

1. Open the StudyNova repository.
2. Go to `Settings`.
3. Go to `Collaborators`.
4. Click `Add people`.
5. Add each student's GitHub username or email.
6. Ask each student to accept the invitation.

There is no single permanent collaborator link for a private repository. GitHub sends each invited person their own invitation.

### 2. Protect The Main Branch

On GitHub:

1. Go to `Settings`.
2. Go to `Branches`.
3. Add branch protection for `main`.
4. Turn on `Require a pull request before merging`.
5. Turn on `Do not allow direct pushes`.

This keeps the project safe.

## Student Laptop Setup

Each student should install:

- Git
- Node.js
- VS Code

Then clone the repository:

```bash
git clone https://github.com/smatechNova/studyNova.git
cd studyNova
npm install
```

## Set Git Name And Email

Each student must set their own Git name and email.

Example for Alliyyah:

```bash
git config --global user.name "Alliyyah"
git config --global user.email "alliyyah@example.com"
```

Example for Mutmainnah:

```bash
git config --global user.name "Mutmainnah"
git config --global user.email "mutmainnah@example.com"
```

Use each student's real GitHub email if possible.

## Branch Names

Use these branches:

```text
contrib/alliyyah-home-brand-card
contrib/mutmainnah-sign-in-role-selector
contrib/zainab-student-setup-preview
contrib/ameerah-study-progress-card
contrib/rahmah-parent-summary-card
contrib/alhassan-support-checklist-card
```

## Daily Workflow For Each Student

### 1. Go To Project Folder

```bash
cd studyNova
```

### 2. Get Latest Main

```bash
git checkout main
git pull origin main
```

### 3. Create Your Own Branch

Example:

```bash
git checkout -b contrib/alliyyah-home-brand-card
```

### 4. Work Only Inside Your Folder

Example for Alliyyah:

```text
student-contributions/Alliyyah/
```

### 5. Check Changed Files

```bash
git status
```

### 6. Save The Work

```bash
git add student-contributions/Alliyyah
git commit -m "Add Alliyyah home brand card"
```

### 7. Push The Branch

```bash
git push origin contrib/alliyyah-home-brand-card
```

### 8. Create Pull Request

On GitHub:

1. Open the StudyNova repository.
2. Click `Compare & pull request`.
3. Base branch should be `main`.
4. Compare branch should be the student's branch.
5. Add a short title.
6. Click `Create pull request`.

### 9. Merge Pull Request

The owner reviews the Pull Request.

If it is okay:

1. Click `Merge pull request`.
2. Click `Confirm merge`.

After merge, the student becomes a contributor.

## Exact Commands For Each Student

### Alliyyah

```bash
git checkout main
git pull origin main
git checkout -b contrib/alliyyah-home-brand-card
git add student-contributions/Alliyyah
git commit -m "Add Alliyyah home brand card"
git push origin contrib/alliyyah-home-brand-card
```

### Mutmainnah

```bash
git checkout main
git pull origin main
git checkout -b contrib/mutmainnah-sign-in-role-selector
git add student-contributions/Mutmainnah
git commit -m "Add Mutmainnah sign in role selector"
git push origin contrib/mutmainnah-sign-in-role-selector
```

### Zainab

```bash
git checkout main
git pull origin main
git checkout -b contrib/zainab-student-setup-preview
git add student-contributions/Zainab
git commit -m "Add Zainab student setup preview"
git push origin contrib/zainab-student-setup-preview
```

### Ameerah

```bash
git checkout main
git pull origin main
git checkout -b contrib/ameerah-study-progress-card
git add student-contributions/Ameerah
git commit -m "Add Ameerah study progress card"
git push origin contrib/ameerah-study-progress-card
```

### Rahmah

```bash
git checkout main
git pull origin main
git checkout -b contrib/rahmah-parent-summary-card
git add student-contributions/Rahmah
git commit -m "Add Rahmah parent summary card"
git push origin contrib/rahmah-parent-summary-card
```

### Alhassan

```bash
git checkout main
git pull origin main
git checkout -b contrib/alhassan-support-checklist-card
git add student-contributions/Alhassan
git commit -m "Add Alhassan support checklist card"
git push origin contrib/alhassan-support-checklist-card
```

## How To Switch Branches

Show all local branches:

```bash
git branch
```

Switch to main:

```bash
git checkout main
```

Switch to your branch:

```bash
git checkout contrib/alliyyah-home-brand-card
```

## How To Fix If A Student Is On The Wrong Branch

Check current branch:

```bash
git branch
```

If they are on `main`, switch to their branch:

```bash
git checkout contrib/student-branch-name
```

If the branch does not exist yet:

```bash
git checkout -b contrib/student-branch-name
```

## Rules

1. Do not push directly to `main`.
2. Work only in your assigned folder.
3. Do not edit `apps/api`.
4. Do not edit `package.json`.
5. Do not run `npm audit fix`.
6. Pull latest `main` before starting.
7. Open a Pull Request after pushing.

