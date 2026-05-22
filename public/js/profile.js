(function () {
  const form = document.querySelector('[data-profile-form]');

  if (!form) {
    return;
  }

  const editButton = document.querySelector('[data-profile-edit]');
  const cancelButton = document.querySelector('[data-profile-cancel]');
  const saveButton = document.querySelector('[data-profile-save]');
  const actionButtons = form.querySelector('.profile-inline-actions');
  const editableFields = form.querySelectorAll('[data-profile-editable]');
  const summaryName = document.querySelector('[data-profile-summary-name]');
  const summaryUsername = document.querySelector('[data-profile-summary-username]');
  const summaryEmail = document.querySelector('[data-profile-summary-email]');
  const summaryPhone = document.querySelector('[data-profile-summary-phone]');
  const summaryRole = document.querySelector('[data-profile-summary-role]');
  const avatar = document.querySelector('[data-profile-avatar]');
  const title = document.querySelector('[data-profile-title]');

  const setEditState = function (isEditing) {
    editableFields.forEach(function (field) {
      if (isEditing) {
        field.dataset.initialValue = field.value;
        field.removeAttribute('disabled');
      } else {
        field.setAttribute('disabled', 'disabled');
      }
    });

    if (editButton) {
      editButton.hidden = isEditing;
    }

    if (saveButton) {
      saveButton.hidden = !isEditing;
    }

    if (cancelButton) {
      cancelButton.hidden = !isEditing;
    }

    if (actionButtons) {
      actionButtons.hidden = !isEditing;
    }

    form.classList.toggle('profile-editing', isEditing);

    if (isEditing && editableFields.length > 0) {
      editableFields[0].focus();
    }
  };

  const updateField = function (selector, value) {
    const element = document.querySelector(selector);
    if (element && typeof value !== 'undefined' && value !== null) {
      element.textContent = value;
    }
  };

  const updateInputs = function (profile) {
    editableFields.forEach(function (field) {
      if (field.name === 'full_name' && (profile.full_name || profile.customer_full_name || profile.display_name)) {
        field.value = profile.full_name || profile.customer_full_name || profile.display_name || '';
        return;
      }

      if (field.name === 'organizer_name' && (profile.organizer_name || profile.display_name)) {
        field.value = profile.organizer_name || profile.display_name || '';
        return;
      }

      if (field.name === 'contact_email' && (profile.contact_email || profile.email)) {
        field.value = profile.contact_email || profile.email || '';
        return;
      }

      if (field.name && Object.prototype.hasOwnProperty.call(profile, field.name)) {
        field.value = profile[field.name] ?? '';
      }
    });

    const usernameField = form.querySelector('[name="username"]');
    const fullNameField = form.querySelector('[name="full_name"], [name="organizer_name"]');
    const emailField = form.querySelector('[name="email"], [name="contact_email"]');
    const phoneField = form.querySelector('[name="phone_number"]');

    updateField('[data-profile-summary-name]', profile.display_name || profile.full_name || profile.customer_full_name || profile.organizer_name || profile.username || '');
    updateField('[data-profile-summary-username]', profile.username ? '@' + profile.username : '-');
    updateField('[data-profile-summary-email]', profile.email || profile.contact_email || '-');
    updateField('[data-profile-summary-phone]', profile.phone_number || '-');
    updateField('[data-profile-summary-role]', profile.role || profile.roles || '');

    if (avatar) {
      const source = profile.display_name || profile.full_name || profile.customer_full_name || profile.organizer_name || profile.username || 'U';
      avatar.textContent = source.charAt(0).toUpperCase();
    }

    if (title) {
      const source = profile.display_name || profile.full_name || profile.customer_full_name || profile.organizer_name || profile.username || 'Profil';
      title.textContent = source;
    }

    if (usernameField && profile.username) {
      usernameField.value = profile.username;
    }

    if (fullNameField && (profile.full_name || profile.customer_full_name || profile.organizer_name || profile.display_name)) {
      fullNameField.value = profile.full_name || profile.customer_full_name || profile.organizer_name || profile.display_name;
    }

    if (emailField && (profile.email || profile.contact_email)) {
      emailField.value = profile.email || profile.contact_email;
    }

    if (phoneField && profile.phone_number) {
      phoneField.value = profile.phone_number;
    }

    const currentUsernameInput = form.querySelector('[name="current_username"]');
    if (currentUsernameInput && profile.username) {
      currentUsernameInput.value = profile.username;
    }
  };

  if (editButton) {
    editButton.addEventListener('click', function () {
      setEditState(true);
    });
  }

  if (cancelButton) {
    cancelButton.addEventListener('click', function () {
      editableFields.forEach(function (field) {
        field.value = field.dataset.initialValue || field.value;
      });
      setEditState(false);
    });
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = {};

    formData.forEach(function (value, key) {
      payload[key] = value;
    });

    try {
      const response = await fetch(form.getAttribute('action') || '/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        if (typeof showSuccessToast === 'function') {
          showSuccessToast(result.message || 'Profil berhasil diperbarui');
        }

        if (result.profile) {
          updateInputs(result.profile);
        }

        setEditState(false);

        if (result.redirectUrl) {
          setTimeout(function () {
            window.location.href = result.redirectUrl;
          }, 700);
        }
      } else {
        if (typeof showErrorToast === 'function') {
          showErrorToast(result.message || 'Profil gagal diperbarui');
        }
      }
    } catch (err) {
      if (typeof showErrorToast === 'function') {
        showErrorToast('Error: ' + err.message);
      }
    }
  });
})();
