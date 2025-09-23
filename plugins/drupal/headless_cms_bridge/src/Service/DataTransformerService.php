<?php

namespace Drupal\headless_cms_bridge\Service;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\EntityFieldManagerInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Field\FieldItemListInterface;
use Drupal\node\NodeInterface;
use Drupal\user\UserInterface;
use Drupal\taxonomy\TermInterface;
use Drupal\file\FileInterface;
use Drupal\image\Plugin\Field\FieldType\ImageItem;

/**
 * Service for transforming data between Drupal and CMS formats.
 */
class DataTransformerService {

  /**
   * The entity type manager.
   */
  protected EntityTypeManagerInterface $entityTypeManager;

  /**
   * The entity field manager.
   */
  protected EntityFieldManagerInterface $fieldManager;

  /**
   * The config factory.
   */
  protected ConfigFactoryInterface $configFactory;

  /**
   * Module configuration.
   */
  protected array $config;

  /**
   * Constructs the DataTransformerService.
   */
  public function __construct(
    EntityTypeManagerInterface $entity_type_manager,
    EntityFieldManagerInterface $field_manager,
    ConfigFactoryInterface $config_factory
  ) {
    $this->entityTypeManager = $entity_type_manager;
    $this->fieldManager = $field_manager;
    $this->configFactory = $config_factory;
    $this->loadConfig();
  }

  /**
   * Transforms a Drupal entity to CMS format.
   */
  public function transformEntityToCMS(ContentEntityInterface $entity): array {
    $entity_type = $entity->getEntityTypeId();
    
    switch ($entity_type) {
      case 'node':
        return $this->transformNodeToCMS($entity);
      case 'user':
        return $this->transformUserToCMS($entity);
      case 'taxonomy_term':
        return $this->transformTermToCMS($entity);
      default:
        return $this->transformGenericEntityToCMS($entity);
    }
  }

  /**
   * Transforms a node to CMS format.
   */
  protected function transformNodeToCMS(NodeInterface $node): array {
    $data = [
      // Drupal identifiers
      'drupal_id' => (string) $node->id(),
      'drupal_uuid' => $node->uuid(),
      'drupal_bundle' => $node->bundle(),
      
      // Basic content
      'title' => $node->getTitle(),
      'status' => $node->isPublished() ? 'published' : 'draft',
      'content_type' => 'node',
      'node_type' => $node->bundle(),
      
      // Author information
      'author_id' => (string) $node->getOwnerId(),
      'author_name' => $node->getOwner()->getDisplayName(),
      
      // Timestamps
      'created_at' => $this->formatTimestamp($node->getCreatedTime()),
      'updated_at' => $this->formatTimestamp($node->getChangedTime()),
      
      // Language
      'language' => $node->language()->getId(),
      
      // URL and path
      'url' => $node->toUrl()->toString(),
      'path' => $node->toUrl()->toString(),
      
      // CMS metadata
      'source' => 'drupal',
      'sync_status' => 'synced',
      'last_synced' => date('c'),
    ];

    // Add body field if present
    if ($node->hasField('body') && !$node->get('body')->isEmpty()) {
      $body = $node->get('body')->first();
      $data['body'] = $body->value;
      $data['body_format'] = $body->format;
      $data['body_summary'] = $body->summary;
    }

    // Add custom fields
    $data['custom_fields'] = $this->extractCustomFields($node);
    
    // Add field data
    $data['fields'] = $this->extractFieldData($node);
    
    // Add taxonomy terms
    $data['taxonomy'] = $this->extractTaxonomyTerms($node);
    
    // Add media and files
    $data['media'] = $this->extractMediaFields($node);
    
    // Add SEO data if available
    if ($this->hasMetatagModule() && $node->hasField('field_metatag')) {
      $data['seo'] = $this->extractSeoData($node);
    }

    return $data;
  }

  /**
   * Transforms a user to CMS format.
   */
  protected function transformUserToCMS(UserInterface $user): array {
    $data = [
      // Drupal identifiers
      'drupal_id' => (string) $user->id(),
      'drupal_uuid' => $user->uuid(),
      
      // Basic user info
      'username' => $user->getAccountName(),
      'email' => $user->getEmail(),
      'display_name' => $user->getDisplayName(),
      'status' => $user->isActive() ? 'active' : 'blocked',
      'content_type' => 'user',
      
      // Profile information
      'first_name' => '',
      'last_name' => '',
      'full_name' => $user->getDisplayName(),
      
      // Timestamps
      'created_at' => $this->formatTimestamp($user->getCreatedTime()),
      'updated_at' => $this->formatTimestamp($user->getChangedTime()),
      'last_login' => $this->formatTimestamp($user->getLastLoginTime()),
      'last_access' => $this->formatTimestamp($user->getLastAccessedTime()),
      
      // Language
      'language' => $user->getPreferredLangcode(),
      
      // Roles
      'roles' => array_values($user->getRoles()),
      
      // User preferences
      'timezone' => $user->getTimeZone(),
      
      // CMS metadata
      'source' => 'drupal',
      'sync_status' => 'synced',
      'last_synced' => date('c'),
    ];

    // Extract profile fields
    if ($user->hasField('field_first_name') && !$user->get('field_first_name')->isEmpty()) {
      $data['first_name'] = $user->get('field_first_name')->value;
    }
    
    if ($user->hasField('field_last_name') && !$user->get('field_last_name')->isEmpty()) {
      $data['last_name'] = $user->get('field_last_name')->value;
    }
    
    if (!empty($data['first_name']) || !empty($data['last_name'])) {
      $data['full_name'] = trim($data['first_name'] . ' ' . $data['last_name']);
    }

    // Add custom fields
    $data['custom_fields'] = $this->extractCustomFields($user);
    
    // Add field data
    $data['fields'] = $this->extractFieldData($user);

    return $data;
  }

  /**
   * Transforms a taxonomy term to CMS format.
   */
  protected function transformTermToCMS(TermInterface $term): array {
    $data = [
      // Drupal identifiers
      'drupal_id' => (string) $term->id(),
      'drupal_uuid' => $term->uuid(),
      'drupal_bundle' => $term->bundle(),
      
      // Basic term info
      'name' => $term->getName(),
      'description' => $term->getDescription(),
      'vocabulary' => $term->bundle(),
      'weight' => $term->getWeight(),
      'content_type' => 'taxonomy_term',
      
      // Hierarchy
      'parent_ids' => [],
      'depth' => 0,
      
      // Language
      'language' => $term->language()->getId(),
      
      // URL and path
      'url' => $term->toUrl()->toString(),
      'path' => $term->toUrl()->toString(),
      
      // CMS metadata
      'source' => 'drupal',
      'sync_status' => 'synced',
      'last_synced' => date('c'),
    ];

    // Add parent terms
    $parents = $this->entityTypeManager->getStorage('taxonomy_term')->loadParents($term->id());
    if (!empty($parents)) {
      $data['parent_ids'] = array_keys($parents);
      $data['depth'] = $this->calculateTermDepth($term);
    }

    // Add custom fields
    $data['custom_fields'] = $this->extractCustomFields($term);
    
    // Add field data
    $data['fields'] = $this->extractFieldData($term);

    return $data;
  }

  /**
   * Transforms generic entity to CMS format.
   */
  protected function transformGenericEntityToCMS(ContentEntityInterface $entity): array {
    $data = [
      // Drupal identifiers
      'drupal_id' => (string) $entity->id(),
      'drupal_uuid' => $entity->uuid(),
      'entity_type' => $entity->getEntityTypeId(),
      'bundle' => $entity->bundle(),
      
      // Basic info
      'label' => $entity->label(),
      'language' => $entity->language()->getId(),
      'content_type' => $entity->getEntityTypeId(),
      
      // CMS metadata
      'source' => 'drupal',
      'sync_status' => 'synced',
      'last_synced' => date('c'),
    ];

    // Add custom fields
    $data['custom_fields'] = $this->extractCustomFields($entity);
    
    // Add field data
    $data['fields'] = $this->extractFieldData($entity);

    return $data;
  }

  /**
   * Transforms CMS data to Drupal format.
   */
  public function transformCMSToDrupal(string $entity_type, array $cms_data): array {
    switch ($entity_type) {
      case 'node':
        return $this->transformCMSToNode($cms_data);
      case 'user':
        return $this->transformCMSToUser($cms_data);
      case 'taxonomy_term':
        return $this->transformCMSToTerm($cms_data);
      default:
        return $this->transformCMSToGenericEntity($entity_type, $cms_data);
    }
  }

  /**
   * Transforms CMS data to node format.
   */
  protected function transformCMSToNode(array $cms_data): array {
    $data = [
      'type' => $cms_data['node_type'] ?? 'article',
      'title' => $cms_data['title'] ?? '',
      'status' => $cms_data['status'] === 'published' ? 1 : 0,
      'langcode' => $cms_data['language'] ?? 'en',
    ];

    // Set Drupal ID if provided (for updates)
    if (!empty($cms_data['drupal_id'])) {
      $data['nid'] = $cms_data['drupal_id'];
    }

    // Add body field
    if (!empty($cms_data['body'])) {
      $data['body'] = [
        'value' => $cms_data['body'],
        'format' => $cms_data['body_format'] ?? 'basic_html',
        'summary' => $cms_data['body_summary'] ?? '',
      ];
    }

    // Add custom fields from CMS
    if (!empty($cms_data['custom_fields'])) {
      foreach ($cms_data['custom_fields'] as $field_name => $field_value) {
        $data[$field_name] = $field_value;
      }
    }

    // Add field data
    if (!empty($cms_data['fields'])) {
      foreach ($cms_data['fields'] as $field_name => $field_value) {
        $data[$field_name] = $this->transformFieldValue($field_name, $field_value);
      }
    }

    return $data;
  }

  /**
   * Transforms CMS data to user format.
   */
  protected function transformCMSToUser(array $cms_data): array {
    $data = [
      'name' => $cms_data['username'] ?? '',
      'mail' => $cms_data['email'] ?? '',
      'status' => $cms_data['status'] === 'active' ? 1 : 0,
      'langcode' => $cms_data['language'] ?? 'en',
    ];

    // Set Drupal ID if provided (for updates)
    if (!empty($cms_data['drupal_id'])) {
      $data['uid'] = $cms_data['drupal_id'];
    }

    // Add profile fields
    if (!empty($cms_data['first_name'])) {
      $data['field_first_name'] = $cms_data['first_name'];
    }
    
    if (!empty($cms_data['last_name'])) {
      $data['field_last_name'] = $cms_data['last_name'];
    }

    // Add roles if provided
    if (!empty($cms_data['roles'])) {
      $data['roles'] = $cms_data['roles'];
    }

    // Add custom fields
    if (!empty($cms_data['custom_fields'])) {
      foreach ($cms_data['custom_fields'] as $field_name => $field_value) {
        $data[$field_name] = $field_value;
      }
    }

    return $data;
  }

  /**
   * Transforms CMS data to taxonomy term format.
   */
  protected function transformCMSToTerm(array $cms_data): array {
    $data = [
      'vid' => $cms_data['vocabulary'] ?? 'tags',
      'name' => $cms_data['name'] ?? '',
      'description' => $cms_data['description'] ?? '',
      'weight' => $cms_data['weight'] ?? 0,
      'langcode' => $cms_data['language'] ?? 'en',
    ];

    // Set Drupal ID if provided (for updates)
    if (!empty($cms_data['drupal_id'])) {
      $data['tid'] = $cms_data['drupal_id'];
    }

    // Set parent terms
    if (!empty($cms_data['parent_ids'])) {
      $data['parent'] = $cms_data['parent_ids'];
    }

    // Add custom fields
    if (!empty($cms_data['custom_fields'])) {
      foreach ($cms_data['custom_fields'] as $field_name => $field_value) {
        $data[$field_name] = $field_value;
      }
    }

    return $data;
  }

  /**
   * Transforms CMS data to generic entity format.
   */
  protected function transformCMSToGenericEntity(string $entity_type, array $cms_data): array {
    $data = [
      'langcode' => $cms_data['language'] ?? 'en',
    ];

    if (!empty($cms_data['bundle'])) {
      $bundle_key = $this->entityTypeManager->getDefinition($entity_type)->getKey('bundle');
      if ($bundle_key) {
        $data[$bundle_key] = $cms_data['bundle'];
      }
    }

    // Set entity ID if provided (for updates)
    if (!empty($cms_data['drupal_id'])) {
      $id_key = $this->entityTypeManager->getDefinition($entity_type)->getKey('id');
      if ($id_key) {
        $data[$id_key] = $cms_data['drupal_id'];
      }
    }

    // Add custom fields
    if (!empty($cms_data['custom_fields'])) {
      foreach ($cms_data['custom_fields'] as $field_name => $field_value) {
        $data[$field_name] = $field_value;
      }
    }

    return $data;
  }

  /**
   * Extracts custom fields from an entity.
   */
  protected function extractCustomFields(ContentEntityInterface $entity): array {
    $custom_fields = [];
    $field_definitions = $entity->getFieldDefinitions();
    
    foreach ($field_definitions as $field_name => $field_definition) {
      // Skip base fields and empty fields
      if ($field_definition->isBaseField() || $entity->get($field_name)->isEmpty()) {
        continue;
      }
      
      $field_value = $this->extractFieldValue($entity->get($field_name));
      if ($field_value !== NULL) {
        $custom_fields[$field_name] = $field_value;
      }
    }
    
    return $custom_fields;
  }

  /**
   * Extracts all field data from an entity.
   */
  protected function extractFieldData(ContentEntityInterface $entity): array {
    $fields = [];
    $field_definitions = $entity->getFieldDefinitions();
    
    foreach ($field_definitions as $field_name => $field_definition) {
      if ($entity->get($field_name)->isEmpty()) {
        continue;
      }
      
      $field_value = $this->extractFieldValue($entity->get($field_name));
      if ($field_value !== NULL) {
        $fields[$field_name] = [
          'type' => $field_definition->getType(),
          'label' => $field_definition->getLabel(),
          'value' => $field_value,
          'cardinality' => $field_definition->getFieldStorageDefinition()->getCardinality(),
        ];
      }
    }
    
    return $fields;
  }

  /**
   * Extracts value from a field.
   */
  protected function extractFieldValue(FieldItemListInterface $field): mixed {
    if ($field->isEmpty()) {
      return NULL;
    }

    $field_type = $field->getFieldDefinition()->getType();
    $values = [];

    foreach ($field as $item) {
      switch ($field_type) {
        case 'string':
        case 'text':
        case 'text_long':
        case 'text_with_summary':
          $values[] = [
            'value' => $item->value,
            'format' => $item->format ?? NULL,
            'summary' => $item->summary ?? NULL,
          ];
          break;

        case 'integer':
        case 'decimal':
        case 'float':
          $values[] = $item->value;
          break;

        case 'boolean':
          $values[] = (bool) $item->value;
          break;

        case 'email':
        case 'telephone':
        case 'link':
          $values[] = [
            'value' => $item->value,
            'uri' => $item->uri ?? NULL,
            'title' => $item->title ?? NULL,
          ];
          break;

        case 'entity_reference':
          if ($item->entity) {
            $values[] = [
              'target_id' => $item->target_id,
              'target_type' => $item->entity->getEntityTypeId(),
              'target_label' => $item->entity->label(),
              'target_uuid' => $item->entity->uuid(),
            ];
          }
          break;

        case 'image':
          if ($item->entity) {
            $file = $item->entity;
            $values[] = [
              'target_id' => $item->target_id,
              'alt' => $item->alt,
              'title' => $item->title,
              'width' => $item->width,
              'height' => $item->height,
              'url' => $file->createFileUrl(),
              'filename' => $file->getFilename(),
              'filesize' => $file->getSize(),
              'mimetype' => $file->getMimeType(),
            ];
          }
          break;

        case 'file':
          if ($item->entity) {
            $file = $item->entity;
            $values[] = [
              'target_id' => $item->target_id,
              'description' => $item->description,
              'url' => $file->createFileUrl(),
              'filename' => $file->getFilename(),
              'filesize' => $file->getSize(),
              'mimetype' => $file->getMimeType(),
            ];
          }
          break;

        case 'datetime':
        case 'daterange':
          $values[] = [
            'value' => $item->value,
            'end_value' => $item->end_value ?? NULL,
            'timezone' => $item->timezone ?? NULL,
          ];
          break;

        default:
          // Generic handling for other field types
          $item_values = $item->getValue();
          $values[] = count($item_values) === 1 ? reset($item_values) : $item_values;
      }
    }

    // Return single value for single-value fields
    if ($field->getFieldDefinition()->getFieldStorageDefinition()->getCardinality() === 1) {
      return reset($values);
    }

    return $values;
  }

  /**
   * Extracts taxonomy terms from an entity.
   */
  protected function extractTaxonomyTerms(ContentEntityInterface $entity): array {
    $taxonomies = [];
    $field_definitions = $entity->getFieldDefinitions();
    
    foreach ($field_definitions as $field_name => $field_definition) {
      if ($field_definition->getType() === 'entity_reference' && 
          $field_definition->getSettings()['target_type'] === 'taxonomy_term') {
        
        $terms = [];
        foreach ($entity->get($field_name) as $item) {
          if ($item->entity) {
            $term = $item->entity;
            $terms[] = [
              'id' => $term->id(),
              'name' => $term->getName(),
              'vocabulary' => $term->bundle(),
              'uuid' => $term->uuid(),
            ];
          }
        }
        
        if (!empty($terms)) {
          $taxonomies[$field_name] = $terms;
        }
      }
    }
    
    return $taxonomies;
  }

  /**
   * Extracts media fields from an entity.
   */
  protected function extractMediaFields(ContentEntityInterface $entity): array {
    $media = [];
    $field_definitions = $entity->getFieldDefinitions();
    
    foreach ($field_definitions as $field_name => $field_definition) {
      if (in_array($field_definition->getType(), ['image', 'file'])) {
        $files = [];
        
        foreach ($entity->get($field_name) as $item) {
          if ($item->entity) {
            $file = $item->entity;
            $file_data = [
              'id' => $file->id(),
              'uuid' => $file->uuid(),
              'filename' => $file->getFilename(),
              'url' => $file->createFileUrl(),
              'filesize' => $file->getSize(),
              'mimetype' => $file->getMimeType(),
            ];
            
            // Add image-specific data
            if ($field_definition->getType() === 'image') {
              $file_data['alt'] = $item->alt;
              $file_data['title'] = $item->title;
              $file_data['width'] = $item->width;
              $file_data['height'] = $item->height;
            }
            
            $files[] = $file_data;
          }
        }
        
        if (!empty($files)) {
          $media[$field_name] = $files;
        }
      }
    }
    
    return $media;
  }

  /**
   * Extracts SEO data if Metatag module is available.
   */
  protected function extractSeoData(ContentEntityInterface $entity): array {
    $seo = [];
    
    if ($this->hasMetatagModule() && $entity->hasField('field_metatag')) {
      $metatag_field = $entity->get('field_metatag');
      if (!$metatag_field->isEmpty()) {
        $metatag_values = $metatag_field->first()->getValue();
        if (!empty($metatag_values['value'])) {
          $metatags = unserialize($metatag_values['value']);
          $seo = $metatags;
        }
      }
    }
    
    return $seo;
  }

  /**
   * Calculates the depth of a taxonomy term.
   */
  protected function calculateTermDepth(TermInterface $term): int {
    $parents = $this->entityTypeManager->getStorage('taxonomy_term')->loadParents($term->id());
    if (empty($parents)) {
      return 0;
    }
    
    $max_depth = 0;
    foreach ($parents as $parent) {
      $parent_depth = $this->calculateTermDepth($parent);
      $max_depth = max($max_depth, $parent_depth + 1);
    }
    
    return $max_depth;
  }

  /**
   * Transforms a field value from CMS format to Drupal format.
   */
  protected function transformFieldValue(string $field_name, mixed $field_value): mixed {
    // This is a simplified implementation
    // In practice, you'd need more sophisticated field type detection and transformation
    return $field_value;
  }

  /**
   * Formats a timestamp for CMS consumption.
   */
  protected function formatTimestamp(?int $timestamp): ?string {
    return $timestamp ? date('c', $timestamp) : NULL;
  }

  /**
   * Checks if the Metatag module is available.
   */
  protected function hasMetatagModule(): bool {
    return \Drupal::moduleHandler()->moduleExists('metatag');
  }

  /**
   * Loads module configuration.
   */
  protected function loadConfig(): void {
    $config = $this->configFactory->get('headless_cms_bridge.settings');
    $this->config = [
      'transform_images' => $config->get('transform_images') ?: TRUE,
      'include_unpublished_references' => $config->get('include_unpublished_references') ?: FALSE,
      'field_mapping' => $config->get('field_mapping') ?: [],
      'exclude_fields' => $config->get('exclude_fields') ?: [],
    ];
  }

}