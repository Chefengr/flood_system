# Use PHP with Apache (make sure it's not just "php:8.1")
FROM php:8.1-apache

# Copy your app files into the Apache web root
COPY . /var/www/html/

# Enable Apache mod_rewrite (if you need clean URLs)
RUN a2enmod rewrite

# Set proper permissions (optional but recommended)
RUN chown -R www-data:www-data /var/www/html

# Expose port 80 (Apache default)
EXPOSE 80

# Start Apache in the foreground
CMD ["apache2-foreground"]
